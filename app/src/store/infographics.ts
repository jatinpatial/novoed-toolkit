/**
 * Infographic store (Track-G — 4th Studio in the suite).
 *
 * Same architectural shape as the Scripts + KCs stores: own
 * localStorage namespace, agent-generated content lives here as
 * a self-contained Infographic record.
 *
 * The agent's MODE 6 (Infographic Builder) writes structured
 * `points[]` via the write_infographic tool. The FE renders points
 * into one of nine styled visual layouts at view time, picked by
 * the `style` field on the record.
 *
 * Track-X2: 4 new sophisticated layouts added on top of the original
 * 5 — stat_spotlight (hero numbers), pyramid (hierarchy), cycle
 * (closed-loop flow), five_forces (Porter-style central + spokes).
 * Existing saves continue to render — the renderer's switch covers
 * all 9 cases and each has its own React subcomponent.
 */

export type InfographicStyle =
  | "process"
  | "quadrant"
  | "comparison"
  | "numbered_list"
  | "timeline"
  | "stat_spotlight"
  | "pyramid"
  | "cycle"
  | "five_forces";

export interface InfographicPoint {
  heading: string;
  body: string;
  iconHint?: string;
}

/** Track-S: output formats. PNG ships in MVP; HTML + SCORM are
 *  surfaced as options but submit triggers a "coming soon" toast
 *  rather than going through. Recording the LD's choice lets us
 *  measure intent for week-2 implementation prioritization. */
export type InfographicFormat = "png" | "html" | "scorm";

export interface Infographic {
  id: string;
  /** Editable display title — defaults to the topic. */
  title: string;
  /** Form's "topic" field, preserved for prompt context across
   *  rebuilds + Refine in chat. */
  topic: string;
  style: InfographicStyle;
  pointCount: number;
  notes: string;
  /** Optional one-line framing under the title — agent writes when
   *  warranted (≤ 15 words). */
  subtitle: string;
  /** Agent-generated structured points. Empty when the Infographic is
   *  freshly created and the build_infographic round-trip hasn't
   *  completed. */
  points: InfographicPoint[];
  /** SDK-reported cost for the build, surfaced on the result page. */
  costUsd: number | null;
  /** Track-S: form-collected output format. PNG = current path;
   *  HTML / SCORM = recorded for week-2 implementation. */
  format?: InfographicFormat;
  /** Track-S: form-collected toggles. brand uses the active brand's
   *  color tokens; peopleImages requests Pexels people-photo
   *  embedding (requires PEXELS_API_KEY configured). */
  useBrandColors?: boolean;
  includePeopleImages?: boolean;
  /** GG4: cached Pexels photo URL per point. When includePeopleImages
   *  is true, the renderer fetches a topical professional-people photo
   *  per point and persists the URL here so reloads don't re-fetch.
   *  Index aligns with `points[]`; null means "no photo found / fetch
   *  in progress / fetch failed — fall back to the BCG icon". */
  pointPhotoUrls?: (string | null)[];
  // Track-R4b: Pexels cover for the chip on the home ContinueBar.
  // Auto-fetched on first card render; persisted so the cover stays
  // stable across reloads.
  coverImageUrl?: string;
  coverPhotographer?: string;
  coverPhotographerUrl?: string;
  /** BB2: per-element color overrides applied on top of the base
   *  brand cascade. Keyed by element id (e.g. "title", "subtitle",
   *  "point-0-heading", "point-2-body"); value is any valid CSS
   *  color string. Empty / missing entries fall back to the brand
   *  cascade defaults. */
  styleOverrides?: Record<string, string>;
  /** Track-V3 (multilingual extends to infographics): ISO language
   *  code of the infographic's content. Set when an LD translates
   *  via the Translate button. Undefined for original (English)
   *  infographics. Used by the renderer for dir="rtl" + locale
   *  hints; can drive lang attribute on the rendered DOM later. */
  languageCode?: string;
  /** Track-V3: right-to-left flag. True for Arabic / Hebrew / etc.
   *  Renderer applies dir="rtl" to the .ig-frame and the CSS handles
   *  the layout flips (margins, list bullets, accent positions).
   *  Defaults to false / undefined (LTR). */
  rtl?: boolean;
  createdAt: number;
  updatedAt: number;
}

const KEY = "bcgu_studio_infographics_v1";

function read(): Infographic[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Infographic[];
  } catch {
    return [];
  }
}

function write(items: Infographic[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("infographics-changed"));
}

export function listInfographics(): Infographic[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getInfographic(id: string): Infographic | null {
  return read().find((x) => x.id === id) || null;
}

export function saveInfographic(item: Infographic): void {
  const all = read();
  const i = all.findIndex((x) => x.id === item.id);
  const updated: Infographic = { ...item, updatedAt: Date.now() };
  if (i >= 0) all[i] = updated;
  else all.push(updated);
  write(all);
}

export function deleteInfographic(id: string): void {
  write(read().filter((x) => x.id !== id));
}

export function subscribeInfographics(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("infographics-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("infographics-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
