import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { searchImagesCached, type PexelsResult } from "../lib/images";
import {
  THEME_LABELS,
  THEMED_COVER_URLS,
  type CoverTheme,
} from "../lib/themedCover";

/**
 * Track-HH4 + OO1: per-project cover picker.
 *
 * Two stacked sections inside the modal:
 *   1. "Themed covers" — the 12 curated local images. Click a thumb →
 *      onPick fires with that URL.
 *   2. "Search Pexels" — section header + always-visible search input
 *      + result grid. Pre-OO1 this was collapsed behind a small text
 *      button which LDs missed; the section is now always exposed.
 *
 * Pexels fallback is graceful: if the backend returns 503 (no key)
 * the search panel surfaces a friendly note inline, and the LD stays
 * on the curated grid.
 */

interface ThemedCoverPickerProps {
  open: boolean;
  currentUrl?: string;
  /** Used as the default Pexels query when the LD opens the search
   *  panel — typically the project title. */
  searchHint: string;
  onPick: (url: string) => void;
  onClose: () => void;
}

export function ThemedCoverPicker({
  open,
  currentUrl,
  searchHint,
  onPick,
  onClose,
}: ThemedCoverPickerProps) {
  const [query, setQuery] = useState(searchHint);
  const [results, setResults] = useState<PexelsResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setResults(null);
      setSearchError(null);
    } else {
      setQuery(searchHint);
    }
  }, [open, searchHint]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await searchImagesCached(query, "cover");
      if (r.length === 0) {
        setSearchError(
          "No matches. Pexels may be unconfigured (set PEXELS_API_KEY in .env) or the query returned nothing.",
        );
      }
      setResults(r);
    } catch {
      setSearchError("Search failed. Pick from the curated grid above.");
    } finally {
      setSearching(false);
    }
  }

  const themes = Object.entries(THEMED_COVER_URLS) as [CoverTheme, string][];

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
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Choose cover</div>
            <h3 className="text-lg font-bold text-ink-900">Pick a themed cover</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-ink-50 text-ink-500">
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-7">
          {/* Section 1 — Themed covers */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Themed covers</h4>
              <span className="text-[11px] text-ink-400">12 curated</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {themes.map(([theme, url]) => {
                const active = url === currentUrl;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => onPick(url)}
                    className={`themed-cover-tile bcg-editorial-image-tint${active ? " themed-cover-tile-active" : ""}`}
                    style={{ backgroundImage: `url(${url})` }}
                    title={THEME_LABELS[theme]}
                  >
                    <span className="themed-cover-tile-label">{THEME_LABELS[theme]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* OO1: Section 2 — Pexels search. Always visible: section
              header + search input + result grid. Pre-OO1 this was a
              collapsed link inside the themed grid; LDs missed it. */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                Search Pexels
              </h4>
              <span className="text-[11px] text-ink-400">More options →</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
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
            {searchError && (
              <div className="mt-2 text-xs text-red-600">{searchError}</div>
            )}
            {!results && !searchError && !searching && (
              <p className="mt-2 text-xs text-ink-500 italic">
                Type a query and press Enter — Pexels returns up to 5 landscape photos per search.
              </p>
            )}
            {results && results.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onPick(r.url)}
                    className="themed-cover-tile bcg-editorial-image-tint"
                    style={{ backgroundImage: `url(${r.thumb})` }}
                    title={`Photo by ${r.photographer} on Pexels`}
                  >
                    <span className="themed-cover-tile-label">{r.photographer}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
