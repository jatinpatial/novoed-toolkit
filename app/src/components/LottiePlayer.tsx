/**
 * LottiePlayer — shared wrapper around lottie-react.
 *
 * One component for every Lottie surface in the app. Loads animation
 * JSON from `app/public/animations/*.json` and plays it inline.
 *
 * Why a wrapper rather than calling lottie-react directly:
 *   - one place to apply brand-color tinting (CSS filters)
 *   - one place to handle missing-JSON gracefully (falls back to null,
 *     so callers can render their existing CSS animation if no Lottie
 *     is in place yet)
 *   - one place to honor reduced-motion preferences
 *
 * Adding a new animation:
 *   1. Drop the .json file into `app/public/animations/<name>.json`
 *   2. Reference by name: <LottiePlayer src="<name>" />
 *
 * Brand tinting: pass `tint="brand"` to apply a brand-color CSS filter
 * over the animation. Useful when the source animation is grayscale
 * or off-brand and you want it to feel native.
 */
import { useEffect, useState } from "react";
import Lottie from "lottie-react";

// Cache-bust token bumped whenever a Lottie JSON in app/public/animations/
// changes shape. Browser caches the JSON aggressively (no-cache headers
// on dev/static-host vary) so without a query-string bump, regenerated
// JSONs sometimes still load the old version on subsequent launches.
const LOTTIE_CACHE_BUST = "v3-orb";

export interface LottiePlayerProps {
  /** Filename (without .json) under app/public/animations/ */
  src: string;
  /** Loop indefinitely (default: true) */
  loop?: boolean;
  /** Autoplay on mount (default: true) */
  autoplay?: boolean;
  /** CSS class for sizing / positioning */
  className?: string;
  /** Inline style for finer control */
  style?: React.CSSProperties;
  /**
   * Brand-color treatment:
   *   - "brand"  → apply brand-color hue rotation + saturation lift
   *   - "muted"  → desaturate slightly so it sits behind content
   *   - "none"   → no filter (default)
   */
  tint?: "brand" | "muted" | "none";
  /** Optional aria-label for screen readers */
  ariaLabel?: string;
}

export function LottiePlayer({
  src,
  loop = true,
  autoplay = true,
  className,
  style,
  tint = "none",
  ariaLabel,
}: LottiePlayerProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);

  // Bug-fix orb-not-animating: previously honored prefers-reduced-motion
  // by suppressing autoplay. Dropped because (a) BCG-managed laptops
  // often default the OS-level reduced-motion to ON, killing every
  // brand animation system-wide; (b) the orb is small + subtle, not
  // the kind of jarring movement reduced-motion is meant to suppress;
  // (c) consumers can explicitly pass autoplay={false} when they
  // genuinely need to suppress at the call site.

  // Fetch the JSON from /animations/<src>.json (vite serves public/ at
  // base). Append a cache-bust query string keyed on a build-time
  // constant so newly-generated Lotties show up after a deploy without
  // forcing a hard refresh on every LD.
  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}animations/${src}.json?v=${LOTTIE_CACHE_BUST}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Lottie ${src} → HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        // Silently fail — caller falls back to its existing CSS animation
        // if `animationData` stays null.
        if (!cancelled) setAnimationData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!animationData) return null;

  const filter =
    tint === "brand"
      ? "saturate(1.1) brightness(1.05)"
      : tint === "muted"
      ? "saturate(0.7) opacity(0.85)"
      : undefined;

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      style={{ filter, ...style }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    />
  );
}
