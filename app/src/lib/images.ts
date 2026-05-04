/**
 * Track-R4: Pexels client + in-memory result cache.
 *
 * Single shared front-end for the Pexels search proxy that
 * agent-backend ships at /api/images/search. The proxy upgrades the
 * raw Pexels result to a small flat object — see images.py for the
 * server-side shape.
 *
 * Failures are silent: a 503 (no key configured) or a network error
 * returns []. Callers fall through to the existing gradient
 * placeholders so a missing key never blocks the lesson / card
 * render. The catch path also covers Pexels rate-limiting (200/hr on
 * the free tier) — if we ever exceed it the FE keeps working with
 * fallback gradients.
 *
 * Cache keyed by (query lowercased, type). Once a query lands, the
 * full result list (up to 5) is held so the LD's "Replace" affordance
 * can cycle through the alternates without re-hitting the API.
 */

const HTTP_URL =
  (import.meta.env.VITE_AGENT_HTTP_URL as string | undefined) ??
  "http://127.0.0.1:8766";

export interface PexelsResult {
  id: number;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

export type ImageType = "banner" | "cover";

const cache = new Map<string, PexelsResult[]>();

function cacheKey(query: string, type: ImageType): string {
  return `${query.toLowerCase().trim()}::${type}`;
}

/**
 * Track-R4 follow-up: strip numbering / structural prefixes from
 * lesson titles + project names before they hit Pexels, then append
 * a soft bias term so generic single-word topics don't return
 * kitchens / beaches.
 *
 * Examples:
 *   "1.1 Pricing Strategy"           → "Pricing Strategy professional"
 *   "Module 3: Crisis Management"    → "Crisis Management professional"
 *   "Lesson 2.3 - Stakeholder Maps"  → "Stakeholder Maps professional"
 *   "Week 4 Onboarding"              → "Onboarding professional"
 *   "Pharma 2030 Vision"             → "Pharma 2030 Vision professional"
 *
 * Returns empty string if the input is empty / strips to nothing —
 * caller short-circuits the API call.
 *
 * Same normalization is applied to the cache key, so distinct lesson
 * titles that share the same root topic ("1.1 Pricing Strategy" /
 * "2.3 Pricing Strategy") dedupe to one API call.
 */
export function normalizeQuery(raw: string): string {
  if (!raw) return "";
  let q = raw.trim();
  // Drop leading "Module N", "Lesson N.M", "Week N", "Chapter N",
  // "Unit N", "Part N" (case-insensitive), with optional trailing
  // colon / dash separator.
  q = q.replace(
    /^(?:module|lesson|week|chapter|unit|part|section)\s*\d+(?:\.\d+)?\s*[:\-–—]?\s*/i,
    "",
  );
  // Drop a leading bare numeric ref like "1.1" / "1." / "3) ".
  q = q.replace(/^\d+(?:\.\d+)?\s*[:\-–—)]?\s*/, "");
  // Trim residual punctuation / whitespace.
  q = q.replace(/^[:\-–—\s]+/, "").trim();
  if (!q) return "";
  // Soft bias toward editorial / business stock so the generic
  // single-word lessons ("Strategy", "Mindfulness") don't flow to
  // kitchen / beach results. Cheap insurance — Pexels honors the
  // extra term as a soft signal, not a hard filter.
  return `${q} professional`;
}

/** Fresh fetch — bypasses cache. Used by the Regenerate button.
 *
 *  The query is normalized once before both the API call and the
 *  cache write, so subsequent searchImagesCached calls for the same
 *  raw input hit the cache without a second API round-trip. */
export async function searchImages(
  query: string,
  type: ImageType = "banner",
): Promise<PexelsResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  try {
    const url = `${HTTP_URL}/api/images/search?query=${encodeURIComponent(
      normalized,
    )}&type=${type}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results: PexelsResult[] = Array.isArray(data?.results)
      ? data.results
      : [];
    if (results.length > 0) cache.set(cacheKey(normalized, type), results);
    return results;
  } catch {
    return [];
  }
}

/** Cached fetch. Returns the cached result list when present;
 *  otherwise hits the API and populates the cache. */
export async function searchImagesCached(
  query: string,
  type: ImageType = "banner",
): Promise<PexelsResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const key = cacheKey(normalized, type);
  const hit = cache.get(key);
  if (hit) return hit;
  return searchImages(query, type);
}

/** Synchronous peek into the cache. Useful for the Replace-cycle UI
 *  which already has the alternates from the initial fetch. */
export function peekCachedImages(
  query: string,
  type: ImageType = "banner",
): PexelsResult[] | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;
  return cache.get(cacheKey(normalized, type)) ?? null;
}
