/**
 * Scripts store (polish-4a).
 *
 * Standalone Synthesia scripts live in their own localStorage namespace,
 * separate from courses (Project store). Pre-polish-4a, /scripts/new
 * submitted into a fake 1-module-1-lesson-1-video-block course — which
 * worked but exposed full Course Studio chrome (outline tree, lesson
 * canvas, brand toggle, export menu) for what the LD intended as a
 * 60-90 sec script. polish-4a separates the data model so /scripts/:id
 * renders a focused Script Studio surface without pretending the
 * script is a course.
 *
 * Theming: scripts are brand-agnostic at generation time. Brand applies
 * at export, when the script's content gets dropped into a course or
 * exported as .docx. That's why the form (CreateScriptPage) doesn't
 * carry a brand chip and the Script type doesn't carry a brand field.
 */

export interface Script {
  id: string;
  title: string;
  // Form-collected metadata — preserved on the Script so the Scripts
  // list view can show "Topic: …, Audience: …" without re-parsing the
  // script content.
  topic: string;
  audience: string;
  /** Human-readable duration label, e.g. "90 sec" / "2 min" / custom string. */
  duration: string;
  /** Tone label from the form: Conversational / Authoritative / Narrative. */
  tone: string;
  /** Avatar mode — picks the script voice + visual density. */
  speakerMode: "speaker" | "narration";
  notes: string;
  /** The agent-written SPOKEN / VISUAL scene text. Empty when the
   *  Script is freshly created and the agent hasn't run yet. */
  content: string;
  /** HH3 / JJ: themed cover image for the home Recent-scripts strip
   *  + ProjectsLibrary tile. Resolved via useCoverImage on first
   *  render and persisted so the cover stays stable across reloads. */
  coverImageUrl?: string;
  coverPhotographer?: string;
  coverPhotographerUrl?: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = "bcgu_studio_scripts_v1";

function read(): Script[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Script[];
  } catch {
    return [];
  }
}

function write(scripts: Script[]) {
  localStorage.setItem(KEY, JSON.stringify(scripts));
  window.dispatchEvent(new CustomEvent("scripts-changed"));
}

export function listScripts(): Script[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getScript(id: string): Script | null {
  return read().find((s) => s.id === id) || null;
}

export function saveScript(script: Script): void {
  const scripts = read();
  const i = scripts.findIndex((s) => s.id === script.id);
  const updated: Script = { ...script, updatedAt: Date.now() };
  if (i >= 0) {
    scripts[i] = updated;
  } else {
    scripts.push(updated);
  }
  write(scripts);
}

export function deleteScript(id: string): void {
  write(read().filter((s) => s.id !== id));
}

export function subscribeScripts(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("scripts-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("scripts-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
