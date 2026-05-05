import { useEffect, useRef, useState } from "react";
import { Droplet, RefreshCw, RotateCw, Search, Upload, X } from "lucide-react";
import {
  peekCachedImages,
  searchImages,
  searchImagesCached,
  type PexelsResult,
} from "../lib/images";

/**
 * Track-R4a: lesson hero banner with auto-fetch + hover affordances.
 *
 * Behavior:
 *   - On mount (or when `query` changes) and `imageUrl` is unset,
 *     async-fetch up to 5 Pexels banner candidates and call
 *     `onChange` with the first hit. Lesson render is never blocked
 *     on the fetch — the placeholder gradient shows until the image
 *     resolves, then fades in.
 *   - Hovering reveals three affordances (top-right): Replace
 *     (cycles through cached alternates), Regenerate (fresh API
 *     call), and Upload (file picker → data URL).
 *   - Drop a file anywhere on the banner to replace via data URL.
 *   - Photographer attribution surfaces in a hover tooltip
 *     (Pexels TOS).
 *
 * Failures are silent — the gradient placeholder stays put and the
 * lesson keeps rendering. Pexels 503 (no key) and network errors
 * funnel through the lib's catch path.
 */

interface LessonBannerProps {
  /** Search query — typically the lesson title. */
  query: string;
  /** Currently-selected image URL, or undefined for the placeholder. */
  imageUrl?: string;
  photographer?: string;
  photographerUrl?: string;
  /** II4: when true, the brand-gradient tint overlay is hidden so the
   *  photo renders pure. Default false → overlay shown. */
  overlayOff?: boolean;
  onChange: (
    url: string | undefined,
    photographer: string | undefined,
    photographerUrl: string | undefined,
  ) => void;
  /** II4: toggle the brand-color tint overlay on / off. */
  onToggleOverlay?: () => void;
}

export function LessonBanner({
  query,
  imageUrl,
  photographer,
  photographerUrl,
  overlayOff = false,
  onChange,
  onToggleOverlay,
}: LessonBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [cached, setCached] = useState<PexelsResult[]>(
    () => peekCachedImages(query, "banner") ?? [],
  );
  const [dragOver, setDragOver] = useState(false);
  // OO2: Pexels-search dialog state. Open via the Search button in
  // the action row; closes on Escape, backdrop click, or after a
  // result is picked.
  const [searchOpen, setSearchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedForRef = useRef<string | null>(null);

  // Auto-fetch on first render when the lesson has no banner yet.
  // Re-runs if the query (lesson title) changes AND the lesson still
  // has no image — the LD's edits to the title shouldn't churn an
  // already-set banner.
  // Bug-fix B6: previously bailed on `cancelled` AND kept the
  // fetchedForRef set to the query — which meant a parent re-render
  // mid-fetch (extremely common because CourseStudio passes a fresh
  // onChange arrow every render) would cancel the in-flight request,
  // and then the next effect pass would see the query already in the
  // ref and skip refetching. Result: lessons rendered with the
  // gradient placeholder until the LD manually clicked Regenerate.
  //
  // Two fixes layered:
  //   1. onChangeRef keeps the latest onChange handler accessible
  //      without making it an effect dep — so the effect doesn't
  //      churn on every parent render.
  //   2. On cancel, we clear fetchedForRef so a follow-up render
  //      can retry. Combined with (1), the effect now re-runs only
  //      when query OR imageUrl actually change, AND a cancelled
  //      run doesn't poison the next attempt.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const trimmed = query?.trim();
    if (!trimmed || imageUrl) return;
    if (fetchedForRef.current === trimmed) return;
    fetchedForRef.current = trimmed;

    let cancelled = false;
    (async () => {
      const results = await searchImagesCached(trimmed, "banner");
      if (cancelled) return;
      if (results.length === 0) return;
      setCached(results);
      const first = results[0];
      onChangeRef.current(first.url, first.photographer, first.photographerUrl);
    })();
    return () => {
      cancelled = true;
      // Allow the next effect pass to retry. Without this, a quick
      // re-render during the in-flight fetch meant the lesson stayed
      // stuck on the gradient until manual Regenerate.
      if (fetchedForRef.current === trimmed) {
        fetchedForRef.current = null;
      }
    };
  }, [query, imageUrl]);

  // Reset the loaded/fade-in flag whenever the URL flips so a swap
  // re-triggers the cross-fade rather than snap-cutting.
  useEffect(() => {
    setLoaded(false);
  }, [imageUrl]);

  function applyResult(r: PexelsResult) {
    onChange(r.url, r.photographer, r.photographerUrl);
  }

  async function handleReplace() {
    let list = cached;
    if (list.length === 0) {
      list = await searchImagesCached(query, "banner");
      if (list.length === 0) return;
      setCached(list);
    }
    const idx = imageUrl
      ? list.findIndex((r) => r.url === imageUrl)
      : -1;
    const next = list[(idx + 1) % list.length];
    if (next) applyResult(next);
  }

  async function handleRegenerate() {
    // GG1: bust the backend cache so we get a genuinely new set of
    // photos rather than the same payload Pexels returned 5 minutes
    // ago. Without `bust`, both the FE cache (skipped by this call
    // path already) and the backend's 30-min cache + Pexels' fixed
    // page=1 conspired to return the same five photos.
    const fresh = await searchImages(query, "banner", { bust: true });
    if (fresh.length === 0) return;
    setCached(fresh);
    applyResult(fresh[0]);
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) onChange(result, undefined, undefined);
    };
    reader.readAsDataURL(file);
  }

  const showImage = Boolean(imageUrl);

  return (
    <div
      className={`lesson-banner${dragOver ? " lesson-banner-dragover" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      {/* Placeholder gradient — always rendered underneath; the photo
          fades in on top once it loads. Keeps the layout stable
          while the network fetch resolves. */}
      <div className="lesson-banner-fallback" aria-hidden="true" />

      {showImage && (
        <img
          src={imageUrl}
          alt=""
          className={`lesson-banner-img bcg-editorial-image${loaded ? " is-loaded" : ""}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      )}

      {/* II4: brand-gradient tint overlay. Sits between the image and
          the actions/credit so the buttons stay legible. Hidden when
          overlayOff is true (LD chose pure photo). */}
      {showImage && !overlayOff && (
        <div className="lesson-banner-overlay" aria-hidden="true" />
      )}

      {/* Hover affordances — only meaningful once we've got an image
          (or at least an attempt). The buttons themselves still work
          on the placeholder so the LD can force a regenerate. */}
      <div className="lesson-banner-actions">
        <button
          type="button"
          onClick={handleReplace}
          className="lesson-banner-btn"
          title="Replace with next stock photo"
          aria-label="Replace banner image"
        >
          <RotateCw size={13} />
          <span>Replace</span>
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          className="lesson-banner-btn"
          title="Fetch a fresh set of stock photos"
          aria-label="Regenerate banner image"
        >
          <RefreshCw size={13} />
          <span>Regenerate</span>
        </button>
        {/* OO2: Pexels search modal trigger. Opens an inline search
            dialog with the lesson title pre-filled. Click any result →
            replaces the banner via the same onChange flow as Replace
            / Regenerate / Upload. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="lesson-banner-btn"
          title="Search Pexels for a specific photo"
          aria-label="Search Pexels for banner image"
        >
          <Search size={13} />
          <span>Search</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="lesson-banner-btn"
          title="Upload your own image"
          aria-label="Upload banner image"
        >
          <Upload size={13} />
          <span>Upload</span>
        </button>
        {/* II4: brand-tint overlay toggle. The button reflects current
            state — "Tint on" when the overlay is showing, "Tint off"
            when the photo is pure. Click flips it. */}
        {onToggleOverlay && (
          <button
            type="button"
            onClick={onToggleOverlay}
            className={`lesson-banner-btn${overlayOff ? "" : " lesson-banner-btn-active"}`}
            title={overlayOff ? "Add brand tint overlay" : "Show pure photo (remove tint)"}
            aria-label="Toggle brand tint overlay"
            aria-pressed={!overlayOff}
          >
            <Droplet size={13} />
            <span>{overlayOff ? "Tint off" : "Tint on"}</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Pexels TOS: photographer credit visible on hover. Anchor opens
          the Pexels profile page in a new tab. Only shown when we have
          attribution data (LD-uploaded images skip this). */}
      {photographer && (
        <div className="lesson-banner-credit">
          {photographerUrl ? (
            <a
              href={photographerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Photo by ${photographer} on Pexels`}
            >
              Photo by {photographer} on Pexels
            </a>
          ) : (
            <span>Photo by {photographer} on Pexels</span>
          )}
        </div>
      )}

      {dragOver && (
        <div className="lesson-banner-dropzone">
          <Upload size={20} />
          <span>Drop image to replace</span>
        </div>
      )}

      {/* OO2: Pexels search dialog — opens when the LD clicks Search
          in the action row. Same UX shape as ThemedCoverPicker's
          search section: prefilled input + result grid; click a
          result to replace. */}
      {searchOpen && (
        <BannerPexelsSearchDialog
          initialQuery={query}
          onPick={(r) => {
            applyResult(r);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * OO2: small modal shared with the lesson banner. Mounted via React
 * portal-equivalent (just a fixed overlay) so the dialog floats above
 * the lesson canvas. Reuses the same `searchImagesCached` lib the
 * banner uses for the auto-fetch + Replace cycle.
 */
function BannerPexelsSearchDialog({
  initialQuery,
  onPick,
  onClose,
}: {
  initialQuery: string;
  onPick: (r: PexelsResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PexelsResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-run a search on mount with the prefilled lesson title — the
  // LD usually wants the dialog to land showing photos, not an empty
  // form. Falls through silently if Pexels is unconfigured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!initialQuery.trim()) return;
      setSearching(true);
      try {
        const r = await searchImagesCached(initialQuery, "banner");
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialQuery]);

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const r = await searchImagesCached(query, "banner");
      if (r.length === 0) {
        setError(
          "No matches. Pexels may be unconfigured (set PEXELS_API_KEY in .env) or the query returned nothing.",
        );
      }
      setResults(r);
    } catch {
      setError("Search failed. Try a different query or use Replace / Upload.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/70 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              Banner image
            </div>
            <h3 className="text-lg font-bold text-ink-900">Search Pexels</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-ink-50 text-ink-500">
            <X size={18} />
          </button>
        </header>
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Search Pexels (e.g. innovation lab)"
                className="w-full pl-9 pr-3 h-9 text-sm rounded-md border border-ink-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="btn-primary btn-sm"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          {results && results.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r)}
                  className="themed-cover-tile bcg-editorial-image-tint"
                  style={{ backgroundImage: `url(${r.thumb})` }}
                  title={`Photo by ${r.photographer} on Pexels`}
                >
                  <span className="themed-cover-tile-label">{r.photographer}</span>
                </button>
              ))}
            </div>
          )}
          {results && results.length === 0 && !error && (
            <p className="mt-3 text-xs text-ink-500 italic">
              No results yet — try a broader query.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
