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
  if (orchestratorState.phase !== "building") return null;

  const total = orchestratorState.totalLessons;
  const done = Object.values(orchestratorState.lessonStates).filter(
    (s) => s === "done",
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const phaseLabel = phaseLabelFor(lastBuildProgress?.kind);

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
        </span>
      </div>
    </div>
  );
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
