import { unzipSync, strFromU8 } from "fflate";

export interface LoadedScorm {
  sessionId: string;
  name: string;
  sizeBytes: number;
  fileCount: number;
  launchFile: string;
  title?: string;
  isStudioExport: boolean;
  studioMeta?: { kind: "component" | "course"; compId?: string };
}

function baseUrl(): string {
  const b = import.meta.env.BASE_URL || "/";
  return b.endsWith("/") ? b : b + "/";
}

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export function isScormPlayerSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export async function ensureWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported in this browser.");
  if (!registrationPromise) {
    const swPath = baseUrl() + "scorm-sw.js";
    const scope = baseUrl();
    registrationPromise = navigator.serviceWorker
      .register(swPath, { scope })
      .then(async (reg) => {
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            const handler = () => { navigator.serviceWorker.removeEventListener("controllerchange", handler); resolve(); };
            navigator.serviceWorker.addEventListener("controllerchange", handler);
            setTimeout(resolve, 2000);
          });
        }
        return reg;
      });
  }
  return registrationPromise;
}

function genSessionId(): string {
  return "s" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

function parseManifest(xml: string): { launch: string | null; title: string | null } {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const resourceEl = doc.querySelector("resource[href]") || doc.querySelector("resource > file[href]");
    const launch = resourceEl?.getAttribute("href") || null;
    const titleEl = doc.querySelector("organization > title, item > title");
    const title = titleEl?.textContent?.trim() || null;
    return { launch, title };
  } catch {
    return { launch: null, title: null };
  }
}

function detectStudioExport(files: Record<string, Uint8Array>): { isStudioExport: boolean; meta?: LoadedScorm["studioMeta"] } {
  if (!files["index.html"]) return { isStudioExport: false };
  try {
    const html = strFromU8(files["index.html"]);
    // Studio-generated HTMLs include the distinctive page-title uppercase class + lp-header for courses
    const isCourse = html.includes('class="lp-header"') && html.includes('class="cb-block"');
    const isComponent = html.includes('class="container"') && html.includes('class="page-title"');
    if (isCourse) return { isStudioExport: true, meta: { kind: "course" } };
    if (isComponent) return { isStudioExport: true, meta: { kind: "component" } };
  } catch { /* ignore */ }
  return { isStudioExport: false };
}

export async function loadScorm(file: File): Promise<LoadedScorm> {
  await ensureWorker();
  const controller = navigator.serviceWorker.controller;
  if (!controller) throw new Error("Service worker is still starting up — please try again in a moment.");

  const buf = new Uint8Array(await file.arrayBuffer());
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(buf);
  } catch (e) {
    throw new Error("Could not read this file. Make sure it's a valid .zip (uncompressed or DEFLATE).");
  }

  // Normalise keys
  const files: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.endsWith("/")) continue; // skip folder entries
    const clean = k.replace(/^\.?\//, "").replace(/\\/g, "/");
    files[clean] = v;
  }

  // Find launch file
  let launchFile: string | null = null;
  let title: string | null = null;
  if (files["imsmanifest.xml"]) {
    const parsed = parseManifest(strFromU8(files["imsmanifest.xml"]));
    launchFile = parsed.launch;
    title = parsed.title;
  }
  if (!launchFile || !files[launchFile]) {
    if (files["index.html"]) launchFile = "index.html";
    else {
      const anyHtml = Object.keys(files).find((k) => /\.html?$/i.test(k));
      launchFile = anyHtml || null;
    }
  }
  if (!launchFile || !files[launchFile]) {
    throw new Error("No playable HTML file found inside this package.");
  }

  const { isStudioExport, meta } = detectStudioExport(files);

  const sessionId = genSessionId();

  // Ship files to the worker
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error("Worker didn't acknowledge package load in time.")), 15000);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "scorm-loaded" && e.data.sessionId === sessionId) {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("message", onMessage);
        channel.port1.close();
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    controller.postMessage({ type: "scorm-load", sessionId, files }, [channel.port2]);
  });

  return {
    sessionId,
    name: file.name,
    sizeBytes: file.size,
    fileCount: Object.keys(files).length,
    launchFile,
    title: title || undefined,
    isStudioExport,
    studioMeta: meta,
  };
}

export function scormIframeSrc(scorm: LoadedScorm): string {
  return `${baseUrl()}scorm-fs/${scorm.sessionId}/${scorm.launchFile}`;
}

export async function unloadScorm(sessionId: string): Promise<void> {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return;
  controller.postMessage({ type: "scorm-unload", sessionId });
}
