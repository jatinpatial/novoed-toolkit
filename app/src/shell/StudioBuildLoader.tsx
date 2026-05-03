import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Track-R / R1: shared loading state for single-piece Studio builds
 * (KC Studio + Infographic Studio).
 *
 * Pre-R1 the loading state was the AgentInflightIndicator centered
 * in a card — same vocabulary the chat panel uses, but felt thin
 * for a 60-90s wait. R1 ships a richer loading state with three
 * pieces:
 *   1. A pulsing brand-gradient orb (matches AgentInflightIndicator's
 *      visual language so the chat-side and studio-side loading
 *      read as the same family).
 *   2. Cycling phrases per phase. Same cadence as polish-12b's
 *      build-progress band (anchor copy first, cycle every 7s).
 *   3. A horizontal time-elapsed bar that fills based on the
 *      provided estimateMs. Doesn't pretend to know the exact
 *      duration — the bar caps at 90% so 100% only ever means
 *      "actually done" (parent unmounts the loader on done).
 *
 * Used by:
 *   - KcStudio.tsx during kcBuilds[id].status === "building"
 *   - InfographicStudio.tsx during infographicBuilds[id].status === "building"
 *
 * Both pages pass their own phrase reel + estimateMs since the
 * patterns differ (KC is "questions" framing; Infographic is
 * "layout / icons" framing).
 */

interface StudioBuildLoaderProps {
  /** Heading shown above the orb. e.g. "Studio Copilot is writing
      your questions…" */
  heading: string;
  /** One-line context below the heading. */
  subhead: string;
  /** Reel of cycling phrases. First phrase is the anchor (shown
      immediately); subsequent phrases cycle every 7s. Reset to
      phrase 0 on mount. */
  phrases: string[];
  /** Rough wall-time estimate in ms. The progress bar caps at 90%
      and fills proportionally to elapsed/estimate. Real completion
      handled by parent unmounting the loader. */
  estimateMs: number;
}

const CYCLE_MS = 7_000;
const CAP_PCT = 90;

export function StudioBuildLoader({
  heading,
  subhead,
  phrases,
  estimateMs,
}: StudioBuildLoaderProps) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phrases.length <= 1) return;
    const t = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }, CYCLE_MS);
    return () => clearInterval(t);
  }, [phrases.length]);

  useEffect(() => {
    // Tick the progress bar every 200ms — smooth-enough fill
    // without thrashing React.
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const fraction = Math.min(1, elapsed / Math.max(1, estimateMs));
      setPct(Math.min(CAP_PCT, fraction * CAP_PCT));
    }, 200);
    return () => clearInterval(tick);
  }, [estimateMs]);

  const phrase = phrases[phraseIdx] || phrases[0] || "Working";

  return (
    <div className="studio-build-loader">
      <div className="studio-build-orb-wrap">
        <div className="studio-build-orb">
          <Sparkles
            size={20}
            className="studio-build-orb-icon"
            aria-hidden="true"
          />
        </div>
      </div>
      <h3 className="studio-build-heading">{heading}</h3>
      <p className="studio-build-sub">{subhead}</p>
      <div className="studio-build-phrase" aria-live="polite">
        {phrase}…
      </div>
      <div className="studio-build-track" aria-hidden="true">
        <div
          className="studio-build-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
