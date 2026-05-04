import { useEffect, useRef } from "react";
import { pickThemedCoverUrl } from "./themedCover";

/**
 * Track-R4b + HH3: lazy cover-image resolver for project / KC /
 * infographic cards.
 *
 * When a card mounts and already has a `currentUrl`, this is a no-op.
 * When it doesn't, the hook synchronously picks a themed cover via
 * pickThemedCoverUrl(query) — keyword-matching the project title to
 * one of 12 curated stock images — and calls `onResolved` so the
 * caller persists onto its store record. Subsequent mounts read the
 * persisted value and skip the resolution entirely.
 *
 * Pre-HH the hook async-fetched from Pexels. We swapped to themed
 * covers because:
 *   - Pexels needs a per-LD API key in .env (pilot LDs aren't always
 *     set up; themed covers work out of the box).
 *   - Pexels results vary per query — same project on two machines
 *     could return different photos. Themed covers are deterministic.
 *   - 12 themes are enough variety for the pilot. The per-project
 *     picker (HH4) has a "Search Pexels for more…" escape hatch for
 *     LDs who want something specific.
 *
 * Photographer + photographerUrl are passed empty since Unsplash
 * licensing doesn't require attribution (and per-project overrides
 * via Pexels persist their own credit when chosen).
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
  const resolvedRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = query?.trim();
    if (!trimmed || currentUrl) return;
    if (resolvedRef.current === trimmed) return;
    resolvedRef.current = trimmed;
    const url = pickThemedCoverUrl(trimmed);
    if (url) onResolved(url, "", "");
  }, [query, currentUrl, onResolved]);
}
