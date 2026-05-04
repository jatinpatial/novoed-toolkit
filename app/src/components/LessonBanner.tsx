import { useEffect, useRef, useState } from "react";
import { Droplet, RefreshCw, RotateCw, Upload } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedForRef = useRef<string | null>(null);

  // Auto-fetch on first render when the lesson has no banner yet.
  // Re-runs if the query (lesson title) changes AND the lesson still
  // has no image — the LD's edits to the title shouldn't churn an
  // already-set banner.
  useEffect(() => {
    const trimmed = query?.trim();
    if (!trimmed || imageUrl) return;
    if (fetchedForRef.current === trimmed) return;
    fetchedForRef.current = trimmed;

    let cancelled = false;
    (async () => {
      const results = await searchImagesCached(trimmed, "banner");
      if (cancelled || results.length === 0) return;
      setCached(results);
      const first = results[0];
      onChange(first.url, first.photographer, first.photographerUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [query, imageUrl, onChange]);

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
          className={`lesson-banner-img${loaded ? " is-loaded" : ""}`}
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
    </div>
  );
}
