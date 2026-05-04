import { useEffect, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { searchImagesCached, type PexelsResult } from "../lib/images";
import {
  THEME_LABELS,
  THEMED_COVER_URLS,
  type CoverTheme,
} from "../lib/themedCover";

/**
 * Track-HH4: per-project cover picker.
 *
 * Modal grid of the 12 themed covers. Click a thumb → onPick fires
 * with that URL. The "Search more…" link toggles a Pexels search
 * box for LDs who want something specific that doesn't fit the
 * curated set.
 *
 * Pexels fallback is graceful: if the backend returns 503 (no key)
 * the search panel surfaces a friendly note, and the LD stays on
 * the curated grid.
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(searchHint);
  const [results, setResults] = useState<PexelsResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchOpen(false);
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

        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {themes.map(([theme, url]) => {
              const active = url === currentUrl;
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => onPick(url)}
                  className={`themed-cover-tile${active ? " themed-cover-tile-active" : ""}`}
                  style={{ backgroundImage: `url(${url})` }}
                  title={THEME_LABELS[theme]}
                >
                  <span className="themed-cover-tile-label">{THEME_LABELS[theme]}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            {!searchOpen ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1.5"
              >
                <ImageIcon size={13} /> Search Pexels for more…
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
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
                    className="flex-1 px-3 h-8 text-sm rounded-md border border-ink-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={runSearch}
                    disabled={searching}
                    className="btn-secondary btn-sm"
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </div>
                {searchError && (
                  <div className="text-xs text-red-600">{searchError}</div>
                )}
                {results && results.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onPick(r.url)}
                        className="themed-cover-tile"
                        style={{ backgroundImage: `url(${r.thumb})` }}
                        title={`Photo by ${r.photographer} on Pexels`}
                      >
                        <span className="themed-cover-tile-label">{r.photographer}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
