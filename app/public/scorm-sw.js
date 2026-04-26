// SCORM virtual filesystem service worker.
// Stores uploaded SCORM packages by session ID and serves them as if they were
// on a regular web server. Handles nested HTML, scripts, CSS url(), iframes, etc.

const MIME = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
};

const sessions = new Map(); // sessionId -> Map(path -> Uint8Array)

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type === "scorm-load") {
    const files = new Map();
    for (const [path, bytes] of Object.entries(msg.files)) {
      files.set(normalize(path), bytes);
    }
    sessions.set(msg.sessionId, files);
    e.source && e.source.postMessage({ type: "scorm-loaded", sessionId: msg.sessionId });
  } else if (msg.type === "scorm-unload") {
    sessions.delete(msg.sessionId);
  } else if (msg.type === "ping") {
    e.source && e.source.postMessage({ type: "pong" });
  }
});

function normalize(p) {
  return p.replace(/^\.?\//, "").replace(/\\/g, "/").replace(/\/+/g, "/");
}

function mimeFor(path) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return MIME[ext] || "application/octet-stream";
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Match /novoed-toolkit/scorm-fs/<session>/<path...> or /scorm-fs/<session>/<path...>
  const m = url.pathname.match(/\/scorm-fs\/([^/]+)\/(.*)$/);
  if (!m) return;
  const sessionId = m[1];
  let filePath = decodeURIComponent(m[2]);
  event.respondWith(serveFile(sessionId, filePath));
});

async function serveFile(sessionId, rawPath) {
  const files = sessions.get(sessionId);
  if (!files) return new Response("Session expired", { status: 410 });

  let path = normalize(rawPath);
  if (!path || path.endsWith("/")) path += "index.html";

  // Direct hit
  if (files.has(path)) return mkResponse(files.get(path), path);

  // Try case-insensitive match
  const lower = path.toLowerCase();
  for (const [k, v] of files) {
    if (k.toLowerCase() === lower) return mkResponse(v, k);
  }

  // Try with/without trailing slash index.html variants
  const candidates = [path + "/index.html", path.replace(/\/index\.html$/, "")];
  for (const c of candidates) {
    const n = normalize(c);
    if (files.has(n)) return mkResponse(files.get(n), n);
  }

  return new Response("Not found: " + path, { status: 404, headers: { "content-type": "text/plain" } });
}

function mkResponse(bytes, path) {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": mimeFor(path),
      "cache-control": "no-store",
    },
  });
}
