/**
 * Infographic store (Track-G — 4th Studio in the suite).
 *
 * Same architectural shape as the Scripts + KCs stores: own
 * localStorage namespace, agent-generated content lives here as
 * a self-contained Infographic record.
 *
 * The agent's MODE 6 (Infographic Builder) writes structured
 * `points[]` via the write_infographic tool. The FE renders points
 * into one of five styled visual layouts at view time, picked by
 * the `style` field on the record.
 */

export type InfographicStyle =
  | "process"
  | "quadrant"
  | "comparison"
  | "numbered_list"
  | "timeline";

export interface InfographicPoint {
  heading: string;
  body: string;
  iconHint?: string;
}

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
