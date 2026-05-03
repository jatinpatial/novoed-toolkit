import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";
import { useAgent } from "./AgentContext";
import type { BuildProgressKind, OrchestratorTargetStatus } from "./types";

/**
 * sprint-2-2: per-lesson state overlay.
 *
 * Renders inside the existing outline tree's lesson row, REPLACING
 * the `[N]` block-count chip during orchestration. We deliberately
 * don't render a parallel list of tiles — the LD already sees lesson
 * 1.1 / 1.2 / 1.3 in the outline tree, so any second list would
 * duplicate that spatial map. Overlay-on-existing keeps the canvas
 * density honest (per locked spec, sprint-2-2).
 *
 * State sources:
 *   idle / undefined  → block-count chip (legacy behavior, no change)
 *   building          → orb pulse (same orb-gradient as the in-message
 *                       indicator — consistent visual language)
 *   done              → green check + block count
 *   error             → red dot. Retry handle lands in sprint-2-7.
 *
 * Read-only in sprint-2-2 — the row's existing onClick (open lesson
 * in canvas) handles all interactions. Cancel / retry / resume land
 * in sprint-2-5 / 2-7.
 */
export function LessonTile({
  absoluteIndex,
  blockCount,
}: {
  absoluteIndex: number;
  blockCount: number;
}) {
  const { orchestratorState } = useAgent();
  // OrchestratorState.to_dict() stringifies dict keys for JSON, so the
  // wire format is `lessonStates: { "0": "building", "1": "idle" }`.
  // Stringify here for the lookup; absoluteIndex is the absolute lesson
  // index across the whole course (matches the BE's index space).
  const status: OrchestratorTargetStatus | undefined =
    orchestratorState.lessonStates[String(absoluteIndex)];

  // Idle / not-yet-orchestrated → keep the legacy block-count chip
  // exactly as it was. This is the steady-state for un-orchestrated
  // courses, so the existing outline tree reads identically.
  if (!status || status === "idle") {
    return <span className="outline-lesson-count-chip">{blockCount}</span>;
  }

  if (status === "building") {
    return (
      <span
        className="lesson-tile-building"
        title="Writing this lesson…"
        aria-label="Writing this lesson"
      >
        <span className="lesson-tile-orb" aria-hidden="true" />
      </span>
    );
  }

  if (status === "done") {
    return (
      <span
        className="lesson-tile-done"
        title="Lesson written"
        aria-label="Lesson written"
      >
        <Check size={10} className="text-brand-700" strokeWidth={3} />
        <span>{blockCount}</span>
      </span>
    );
  }

  // status === "error". Sprint-2-2 ships the visual; the retry click
  // lands in sprint-2-7. Keeping the dot inert for now — the row's
  // existing navigation onClick still fires (locked spec: tiles are
  // read-only in 2-2).
  return (
    <span
      className="lesson-tile-error"
      title="This lesson failed — retry lands in a future update"
      aria-label="Lesson failed"
    >
      <span className="lesson-tile-error-dot" aria-hidden="true" />
    </span>
  );
}

/**
 * sprint-2-2: aggregate build-progress band.
 *
 * Sticky at the top of the lesson canvas pane (NOT the full window
 * — respects the outline + Studio Copilot column boundaries). Visible
 * only while `phase === "building"`; idle / completed / cancelled /
 * paused / failed all hide it.
 *
 * Phase label rotates based on the most recent build_progress event:
 *   lesson_*           → Building lessons…
 *   kc_*               → Building knowledge checks…
 *   cs_*               → Designing case studies…
 *   course_export_*    → Exporting Word doc…
 *   default            → Building course…
 *
 * Width: full pane (the pane is the scroll container, so a sticky
 * top-0 + edge-to-edge works without tracking the outline width).
 *
 * Track / fill: brand-500 fill on brand-50 track. Picks up the active
 * brand toggle automatically via the brand-cascade tokens.
 */
export function BuildProgressBand() {
  const { orchestratorState, lastBuildProgress } = useAgent();

  // polish-7a: capture per-lesson durations as lesson_completed events
  // arrive. Local component state — when phase flips to non-building
  // the band unmounts, which automatically resets this for the next
  // build. No need for a context-level slice.
  const [durationsMs, setDurationsMs] = useState<number[]>([]);
  useEffect(() => {
    if (lastBuildProgress?.kind !== "lesson_completed") return;
    const dur = lastBuildProgress.payload.durationMs;
    if (typeof dur !== "number" || !isFinite(dur) || dur <= 0) return;
    setDurationsMs((prev) => [...prev, dur]);
  }, [lastBuildProgress]);

  if (orchestratorState.phase !== "building") return null;

  const total = orchestratorState.totalLessons;
  const done = Object.values(orchestratorState.lessonStates).filter(
    (s) => s === "done",
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const phaseLabel = phaseLabelFor(lastBuildProgress?.kind);

  // polish-7a + polish-8b: rolling-avg ETA with seed estimate.
  //
  // polish-7a (initial): showed ETA only after 1 lesson had completed.
  // Live testing said that's too long without info — for a 14-lesson
  // course the LD waits ~2 minutes before they get any wall-time
  // signal. ETA was hidden when it was MOST useful.
  //
  // polish-8b (this commit): seed the ETA from t=0 using SEED_MS_PER_LESSON
  // (calibrated from Saturday's telemetry — avg 124s/lesson). The seed
  // gets replaced by the rolling avg as soon as one lesson actually
  // completes, so the number sharpens with real data. Honest from
  // second 1.
  //
  // Hidden when the build is paused / cancelled (band already hides
  // on those phases anyway, but be explicit).
  const remaining = Math.max(0, total - done);
  const avgMs =
    durationsMs.length > 0
      ? durationsMs.reduce((s, d) => s + d, 0) / durationsMs.length
      : SEED_MS_PER_LESSON;
  const etaText = remaining > 0 ? formatEta(avgMs * remaining) : null;

  return (
    <div className="build-progress-band" role="status" aria-live="polite">
      <div className="build-progress-band-track">
        <div
          className="build-progress-band-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="build-progress-band-text">
        <span className="build-progress-band-phase">{phaseLabel}</span>
        <span className="build-progress-band-count">
          {done} of {total} lesson{total === 1 ? "" : "s"} ({pct}%)
          {etaText && (
            <span className="build-progress-band-eta">
              {" · "}
              {etaText}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * polish-8b: seed estimate per lesson, used until the rolling avg
 * has at least one observation. Calibrated from Saturday's first
 * live build telemetry — a 4-lesson course averaged 124s/lesson
 * total wall-time including ~8s init. 120s is a clean round number
 * and slightly conservative, which is the right side to err on for
 * a user-facing ETA.
 *
 * Once one lesson_completed event lands, the rolling avg replaces
 * this seed entirely, so the ETA sharpens automatically. If actual
 * builds run faster (parallel-batch sprint-2-11 lands), the seed
 * over-estimates briefly then the rolling avg corrects within ~30s.
 */
const SEED_MS_PER_LESSON = 120_000;

/**
 * Round-up wall-time formatter. Always overestimates rather than
 * underestimating — the LD's expectation set by an ETA should be
 * conservative so the build feels faster than promised, not slower.
 *
 *   < 60s  → "~Ns remaining"   (rounded up to nearest 5s)
 *   < 60m  → "~N min remaining"
 *   else   → "~Nh Mm remaining"
 */
function formatEta(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) {
    const rounded = Math.ceil(totalSec / 5) * 5;
    return `~${rounded}s remaining`;
  }
  const totalMin = Math.ceil(totalSec / 60);
  if (totalMin < 60) {
    return `~${totalMin} min remaining`;
  }
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return minutes === 0
    ? `~${hours}h remaining`
    : `~${hours}h ${minutes}m remaining`;
}

function phaseLabelFor(kind: BuildProgressKind | undefined): string {
  if (!kind) return "Building course…";
  if (kind.startsWith("lesson_")) return "Building lessons…";
  if (kind.startsWith("kc_")) return "Building knowledge checks…";
  if (kind.startsWith("cs_")) return "Designing case studies…";
  if (kind === "course_export_ready") return "Exporting Word doc…";
  if (kind === "course_completed") return "Wrapping up…";
  return "Building course…";
}

/**
 * polish-7c: confetti burst on course_completed.
 *
 * Returns null — this is an effect-host component. Mount it
 * alongside BuildProgressBand inside the canvas pane; it watches
 * lastBuildProgress and fires a brand-colored burst when the build
 * actually completes.
 *
 * Critically, only `course_completed` fires the confetti — NOT a
 * build_state with phase=completed. The BE only emits the progress
 * event during the actual build run; on page rehydration it pushes
 * build_state alone (no progress event). So a refresh after the
 * build finished doesn't re-trigger the celebration. The
 * firedForBuildRef double-guard belt-and-suspenders against any
 * duplicate event delivery.
 *
 * Two-tap pattern (150 particles spread 80 → 200ms → 50 particles
 * spread 60) gives a satisfying bloom + secondary pop without
 * overstaying its welcome. Brand-aware colors via the runtime
 * --brand-500 / --brand-700 cascade vars, so BCG vs BCG U vs Client
 * each get their own palette automatically.
 */
export function BuildCompletionConfetti() {
  const { lastBuildProgress } = useAgent();
  const firedForBuildRef = useRef(false);

  useEffect(() => {
    if (!lastBuildProgress) return;
    // Reset the fire-once latch when a new build begins. course_started
    // doesn't exist as a kind today; lesson_started on idx 0 is the
    // de-facto build-start signal.
    if (
      lastBuildProgress.kind === "lesson_started" &&
      lastBuildProgress.payload.idx === 0
    ) {
      firedForBuildRef.current = false;
      return;
    }
    if (lastBuildProgress.kind !== "course_completed") return;
    if (firedForBuildRef.current) return;
    firedForBuildRef.current = true;
    fireBurst();
  }, [lastBuildProgress]);

  return null;
}

function fireBurst(): void {
  // Read the runtime brand cascade vars at fire time so the palette
  // matches whatever brand the LD has toggled (BCG / BCG U / Client).
  // Defaults guard against the rare case where vars are unset (early
  // app boot). Whites mixed in for sparkle.
  const root = getComputedStyle(document.documentElement);
  const brand500 = root.getPropertyValue("--brand-500").trim() || "#29BA74";
  const brand700 = root.getPropertyValue("--brand-700").trim() || "#1B7A4F";
  const colors = [brand500, brand700, "#ffffff"];

  // First burst — wide bloom from screen center.
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { x: 0.5, y: 0.55 },
    colors,
    startVelocity: 35,
    scalar: 0.9,
    ticks: 200,
  });
  // Second pop — tighter, fires 200ms after the first for a layered
  // feel (claude.ai-style double-tap).
  window.setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { x: 0.5, y: 0.55 },
      colors,
      startVelocity: 28,
      scalar: 0.8,
      ticks: 180,
    });
  }, 200);
}
