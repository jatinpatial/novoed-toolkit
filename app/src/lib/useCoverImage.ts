import { useEffect, useRef } from "react";
import { searchImagesCached } from "./images";

/**
 * Track-R4b: lazy cover-image fetcher for project / KC / infographic
 * cards.
 *
 * When a card mounts and already has a `currentUrl`, this is a no-op.
 * When it doesn't, the hook async-fetches a Pexels cover by `query`
 * and calls `onResolved` with the first hit so the caller can persist
 * onto its store record. Subsequent mounts read the persisted value
 * and skip the fetch.
 *
 * Failures are silent (Pexels 503 / network) — the caller's existing
 * placeholder gradient stays put.
 */
export function useCoverImage(
  query: string,
  currentUrl: string | undefined,
  onResolved: (
    url: string,
    photographer: string,
    photographerUrl: string,
  ) => void,
) {
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query?.trim();
    if (!trimmed || currentUrl) return;
    if (fetchedRef.current === trimmed) return;
    fetchedRef.current = trimmed;

    let cancelled = false;
    (async () => {
      const results = await searchImagesCached(trimmed, "cover");
      if (cancelled || results.length === 0) return;
      const first = results[0];
      onResolved(first.url, first.photographer, first.photographerUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [query, currentUrl, onResolved]);
}
