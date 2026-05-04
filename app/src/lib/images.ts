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

/** Fresh fetch — bypasses cache. Used by the Regenerate button. */
export async function searchImages(
  query: string,
  type: ImageType = "banner",
): Promise<PexelsResult[]> {
  const trimmed = query?.trim();
  if (!trimmed) return [];
  try {
    const url = `${HTTP_URL}/api/images/search?query=${encodeURIComponent(
      trimmed,
    )}&type=${type}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results: PexelsResult[] = Array.isArray(data?.results)
      ? data.results
      : [];
    if (results.length > 0) cache.set(cacheKey(trimmed, type), results);
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
  const trimmed = query?.trim();
  if (!trimmed) return [];
  const key = cacheKey(trimmed, type);
  const hit = cache.get(key);
  if (hit) return hit;
  return searchImages(trimmed, type);
}

/** Synchronous peek into the cache. Useful for the Replace-cycle UI
 *  which already has the alternates from the initial fetch. */
export function peekCachedImages(
  query: string,
  type: ImageType = "banner",
): PexelsResult[] | null {
  const trimmed = query?.trim();
  if (!trimmed) return null;
  return cache.get(cacheKey(trimmed, type)) ?? null;
}
