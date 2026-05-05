import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";
import { useAgent } from "./AgentContext";
import { LottiePlayer } from "../components/LottiePlayer";
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
 * polish-16c: module knowledge-check state chip. Mirrors LessonTile's
 * vocabulary (orb pulse / green check / red dot) for the [KC] row in
 * the outline tree. Reads orchestratorState.kcStates keyed by
 * "module:<moduleId>" — the wire format the orchestrator emits in
 * sprint-2-8.
 */
export function ModuleKcTile({ moduleId }: { moduleId: string }) {
  const { orchestratorState } = useAgent();
  const status = orchestratorState.kcStates[`module:${moduleId}`];
  if (!status || status === "idle") {
    return <span className="outline-lesson-count-chip">·</span>;
  }
  if (status === "building") {
    return (
      <span className="lesson-tile-building" title="Writing the module final assessment…" aria-label="Building module knowledge check">
        <span className="lesson-tile-orb" aria-hidden="true" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="lesson-tile-done" title="Final assessment written" aria-label="Final assessment written">
        <Check size={10} className="text-brand-700" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="lesson-tile-error" title="Final assessment failed" aria-label="Final assessment failed">
      <span className="lesson-tile-error-dot" aria-hidden="true" />
    </span>
  );
}

/**
 * polish-16c: case-study state chip for the [CS] row. Reads
 * orchestratorState.csStates keyed by case-study slot id. `designed`
 * prop is from the FE's own state (whether the slot has content) —
 * if designed but orchestrator hasn't tracked state, show the
 * "done" check anyway so a hand-edited case study looks complete.
 */
export function CaseStudyTile({ caseStudyId, designed }: { caseStudyId: string; designed: boolean }) {
  const { orchestratorState } = useAgent();
  const status = orchestratorState.csStates[caseStudyId];
  if (status === "building") {
    return (
      <span className="lesson-tile-building" title="Designing case study…" aria-label="Designing case study">
        <span className="lesson-tile-orb" aria-hidden="true" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="lesson-tile-error" title="Case study design failed" aria-label="Case study failed">
        <span className="lesson-tile-error-dot" aria-hidden="true" />
      </span>
    );
  }
  // Done OR no orchestrator state but designed (hand-authored)
  if (status === "done" || designed) {
    return (
      <span className="lesson-tile-done" title="Case study designed" aria-label="Case study designed">
        <Check size={10} className="text-brand-700" strokeWidth={3} />
      </span>
    );
  }
  // Planted but never designed.
  return <span className="outline-lesson-count-chip">·</span>;
}

/**
 * sprint-2-2: aggregate build-progress band.
 *
 * Sticky at the top of the lesson canvas pane (NOT the full window
 * — respects the outline + Studio Copilot column boundaries). Visible
 * only while `phase === "building"`; idle / completed / cancelled /
 * paused / failed all hide it.
 *
 * polish-15a (FULL pipeline progress)
 *   Pre-15a the band counted lessons only — "4 of 4 lessons (100%)"
 *   while KC + CS phases were still running, misleading the LD into
 *   thinking the build was done. Post-15a the denominator is the
 *   FULL pipeline (lessons + KCs + CSs), and 100% only lands when
 *   course_completed fires.
 *
 * polish-15b (state-derived phase label)
 *   Pre-15b the phase label was driven by the most recent progress
 *   event's kind. Between phases (e.g. last lesson_completed, before
 *   first kc_started) the label stayed on the previous phase. Post-15b
 *   the label is derived from STATE — what's done vs in flight —
 *   which is robust to any timing windows between events.
 *
 * Width: full pane (the pane is the scroll container, so a sticky
 * top-0 + edge-to-edge works without tracking the outline width).
 *
 * Track / fill: brand-500 fill on brand-50 track. Picks up the active
 * brand toggle automatically via the brand-cascade tokens.
 */
export function BuildProgressBand() {
  const { orchestratorState, lastBuildProgress } = useAgent();

  // polish-7a + polish-15a: capture step durations across ALL phases
  // (lesson + kc + cs completed events). Pre-15a the durations array
  // only filled from lesson_completed, so ETA stopped sharpening once
  // lessons finished even though KCs + CSs were still running.
  const [durationsMs, setDurationsMs] = useState<number[]>([]);
  useEffect(() => {
    if (!lastBuildProgress) return;
    const isCompletion =
      lastBuildProgress.kind === "lesson_completed" ||
      lastBuildProgress.kind === "kc_completed" ||
      lastBuildProgress.kind === "cs_completed";
    if (!isCompletion) return;
    const dur = lastBuildProgress.payload.durationMs;
    if (typeof dur !== "number" || !isFinite(dur) || dur <= 0) return;
    setDurationsMs((prev) => [...prev, dur]);
  }, [lastBuildProgress]);

  // polish-15b + polish-12b: state-derived phase label that cycles
  // through per-phase copy reels. phraseIndex monotonically
  // increments on a 7s tick; resets to 0 on phase transitions so
  // each new phase starts with its anchor copy. Phase key derived
  // via activePhaseKey to detect transitions.
  // HOTFIX: hooks moved above the early return below so they call
  // unconditionally every render (Rules of Hooks). When the band is
  // hidden (phase !== "building") the timer still ticks but its
  // setState is a no-op against a returned-null tree.
  const [phraseIndex, setPhraseIndex] = useState(0);
  const lastPhaseKeyRef = useRef<string | null>(null);
  const currentPhaseKey = activePhaseKey(orchestratorState, lastBuildProgress?.kind);
  useEffect(() => {
    if (currentPhaseKey !== lastPhaseKeyRef.current) {
      lastPhaseKeyRef.current = currentPhaseKey;
      setPhraseIndex(0);
    }
  }, [currentPhaseKey]);
  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((i) => i + 1);
    }, PHASE_CYCLE_MS);
    return () => clearInterval(timer);
  }, []);

  if (orchestratorState.phase !== "building") return null;

  // polish-15a: combined denominator across all three phases. 100%
  // only when every step in every phase has landed.
  const totalLessons = orchestratorState.totalLessons;
  const totalKcs = orchestratorState.totalKcs;
  const totalCss = orchestratorState.totalCss;
  const totalSteps = totalLessons + totalKcs + totalCss;

  const lessonsDone = Object.values(orchestratorState.lessonStates).filter(
    (s) => s === "done",
  ).length;
  const kcsDone = Object.values(orchestratorState.kcStates).filter(
    (s) => s === "done",
  ).length;
  const cssDone = Object.values(orchestratorState.csStates).filter(
    (s) => s === "done",
  ).length;
  const completedSteps = lessonsDone + kcsDone + cssDone;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const phaseLabel = derivePhaseLabel(
    orchestratorState,
    lastBuildProgress?.kind,
    lastBuildProgress?.payload,
    phraseIndex,
  );

  // polish-15a: ETA now uses combined remaining steps × avg duration
  // across all phases. Seed for pre-data fallback stays the same
  // (~120s/step is roughly accurate for KCs and CSs too — slightly
  // shorter than lessons but in the same ballpark).
  const remaining = Math.max(0, totalSteps - completedSteps);
  const avgMs =
    durationsMs.length > 0
      ? durationsMs.reduce((s, d) => s + d, 0) / durationsMs.length
      : SEED_MS_PER_LESSON;
  const etaText = remaining > 0 ? formatEta(avgMs * remaining) : null;

  return (
    <div className="build-progress-band" role="status" aria-live="polite">
      {/* QQ1 (v4): hand-crafted neural-pulse Lottie as the "AI thinking"
          anchor. Replaces the dud brain.json (2fps + pure black, rendered
          as an invisible blob). neural-pulse is BCG green + teal, breathes
          at 60fps. Falls back silently to nothing if JSON missing — band
          still renders + works. */}
      <div className="build-progress-band-lottie">
        <LottiePlayer src="neural-pulse" className="build-progress-band-lottie-fill" />
      </div>
      <div className="build-progress-band-content">
        <div className="build-progress-band-track">
          <div
            className="build-progress-band-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="build-progress-band-text">
          <span className="build-progress-band-phase">{phaseLabel}</span>
          <span className="build-progress-band-count">
            {completedSteps} of {totalSteps} step{totalSteps === 1 ? "" : "s"} ({pct}%)
            {etaText && (
              <span className="build-progress-band-eta">
                {" · "}
                {etaText}
              </span>
            )}
          </span>
        </div>
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

// polish-12b: per-phase cycling copy reels. Same cadence pattern as
// polish-6a's tool-status reels — first phrase shows immediately,
// then cycles through the rest every 7s. Reels reset to phrase 0 on
// phase change so each new phase starts with its anchor copy. Reels
// give a sense of activity during the long static fills between
// step completions ("Building lessons…" alone for 20 minutes reads
// as stuck even when the band is filling).
//
// Order matters within each reel — phrase 0 is the canonical
// label; later phrases drift into more characterful copy.
const PHASE_REELS: Record<string, string[]> = {
  building_lessons: [
    "Building lessons",
    "Stitching the narrative together",
    "Adding the story beats",
    "Cooking up the takeaways",
    "Threading the arc",
    "Polishing the prose",
  ],
  building_kcs: [
    "Building knowledge checks",
    "Crafting questions that stick",
    "Calibrating difficulty",
    "Writing distractors that tempt",
    "Adding rationales",
  ],
  building_cs: [
    "Designing case studies",
    "Setting the scene",
    "Building the dilemma",
    "Crafting the stakes",
    "Voicing the stakeholders",
  ],
  exporting: [
    "Exporting to Word",
    "Formatting the document",
    "Adding final touches",
    "Almost there",
  ],
};
const PHASE_CYCLE_MS = 7_000;

/**
 * polish-15b + polish-12b: derive the band's phase label from
 * CURRENT STATE rather than the most recent event's kind, AND cycle
 * through a per-phase reel of variant copy so the band reads as
 * alive during long phase fills.
 *
 * Priority order:
 *   1. Active retry event   → "Retrying lesson N…" / etc. (kind-based)
 *   2. course_export_ready  → "Exporting…" reel (kind-based)
 *   3. course_completed     → "Wrapping up…" (kind-based)
 *   4. State-derived current phase based on what's done vs in flight,
 *      cycling through that phase's reel every PHASE_CYCLE_MS.
 *
 * The state-derived path picks the EARLIEST phase that's still
 * incomplete:
 *   - lessons not all done → "Building lessons…" reel
 *   - lessons done, KCs not all done → "Building knowledge checks…" reel
 *   - lessons + KCs done, CSs not all done → "Designing case studies…" reel
 *   - everything done → "Almost done"
 */
function derivePhaseLabel(
  state: import("./types").OrchestratorState,
  kind: BuildProgressKind | undefined,
  payload: Record<string, unknown> | undefined,
  phraseIndex: number,
): string {
  // 1) Retry events take priority — even if the underlying phase
  //    is "lessons", the LD wants to know they're inside a recovery.
  if (
    kind === "lesson_retrying" ||
    kind === "kc_retrying" ||
    kind === "cs_retrying"
  ) {
    const idx = typeof payload?.idx === "number" ? payload.idx : null;
    const attempt = typeof payload?.attempt === "number" ? payload.attempt : null;
    const max = typeof payload?.maxAttempts === "number" ? payload.maxAttempts : null;
    const targetRef =
      kind === "kc_retrying"
        ? " knowledge check"
        : kind === "cs_retrying"
          ? " case study"
          : idx !== null
            ? ` lesson ${idx + 1}`
            : " lesson";
    const attemptRef =
      attempt !== null && max !== null ? ` (attempt ${attempt + 1}/${max})` : "";
    return `Retrying${targetRef}${attemptRef}…`;
  }

  // 2) Pipeline-end signals.
  if (kind === "course_export_ready") {
    const reel = PHASE_REELS.exporting;
    return `${reel[phraseIndex % reel.length]}…`;
  }
  if (kind === "course_completed") return "Wrapping up…";

  // 3) State-derived current phase + cycling reel.
  const lessonsAllDone =
    state.totalLessons === 0 ||
    Object.values(state.lessonStates).filter((s) => s === "done").length >=
      state.totalLessons;
  const kcsAllDone =
    state.totalKcs === 0 ||
    Object.values(state.kcStates).filter((s) => s === "done").length >=
      state.totalKcs;
  const cssAllDone =
    state.totalCss === 0 ||
    Object.values(state.csStates).filter((s) => s === "done").length >=
      state.totalCss;

  if (!lessonsAllDone) {
    const reel = PHASE_REELS.building_lessons;
    return `${reel[phraseIndex % reel.length]}…`;
  }
  if (!kcsAllDone) {
    const reel = PHASE_REELS.building_kcs;
    return `${reel[phraseIndex % reel.length]}…`;
  }
  if (!cssAllDone) {
    const reel = PHASE_REELS.building_cs;
    return `${reel[phraseIndex % reel.length]}…`;
  }
  return "Almost done…";
}

/**
 * polish-12b: derive the active phase key from the same logic the
 * label uses, so the cycling effect can detect phase transitions
 * and reset the phrase index to 0 (anchor copy first on each new
 * phase).
 */
function activePhaseKey(
  state: import("./types").OrchestratorState,
  kind: BuildProgressKind | undefined,
): string {
  if (kind === "course_export_ready") return "exporting";
  if (kind === "course_completed") return "wrapping_up";
  if (
    kind === "lesson_retrying" ||
    kind === "kc_retrying" ||
    kind === "cs_retrying"
  ) {
    return "retry";
  }
  const lessonsAllDone =
    state.totalLessons === 0 ||
    Object.values(state.lessonStates).filter((s) => s === "done").length >=
      state.totalLessons;
  const kcsAllDone =
    state.totalKcs === 0 ||
    Object.values(state.kcStates).filter((s) => s === "done").length >=
      state.totalKcs;
  const cssAllDone =
    state.totalCss === 0 ||
    Object.values(state.csStates).filter((s) => s === "done").length >=
      state.totalCss;
  if (!lessonsAllDone) return "building_lessons";
  if (!kcsAllDone) return "building_kcs";
  if (!cssAllDone) return "building_cs";
  return "almost_done";
}

/**
 * polish-7c + polish-15e: confetti burst on build completion.
 *
 * Returns null — this is an effect-host component. Mount it
 * alongside BuildProgressBand inside the canvas pane; it watches
 * orchestratorState.phase and fires a brand-colored burst when the
 * build transitions building → completed.
 *
 * polish-15e bug fix
 *   Pre-15e the trigger was lastBuildProgress.kind === "course_completed".
 *   The orchestrator emits course_completed + course_export_ready
 *   in rapid succession (no await between them in build_full_course).
 *   React 18 batches the two setLastBuildProgress calls within the
 *   same microtask, so the effect with [lastBuildProgress] dep sees
 *   only the LATEST value (course_export_ready, kind !== "course_completed").
 *   The course_completed event was effectively swallowed and the
 *   confetti never fired.
 *
 *   Fix: trigger on orchestratorState.phase transition. The phase
 *   updates via build_state events (a SEPARATE state slice from
 *   lastBuildProgress), so the building → completed transition
 *   reliably triggers the effect. Tracks lastPhaseRef to detect
 *   the actual transition (vs just observing phase=completed which
 *   would also fire on rehydration of an already-completed build).
 *
 * Suppress on rehydration
 *   Page-refresh / WS-reconnect AFTER a build finished pushes a
 *   build_state with phase=completed but the FE didn't observe the
 *   transition. The lastPhaseRef starts as null on mount; only when
 *   we see building first AND THEN completed do we fire. That makes
 *   the celebration tied to the lived experience of the build
 *   finishing, not to any time the FE is in a "completed" state.
 *
 * Two-tap pattern (150 particles spread 80 → 200ms → 50 particles
 * spread 60) gives a satisfying bloom + secondary pop without
 * overstaying its welcome. Brand-aware colors via the runtime
 * --brand-500 / --brand-700 cascade vars, so BCG vs BCG U vs Client
 * each get their own palette automatically.
 */
export function BuildCompletionConfetti() {
  const { orchestratorState } = useAgent();
  const lastPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    const phase = orchestratorState.phase;
    const prev = lastPhaseRef.current;
    lastPhaseRef.current = phase;
    // Only fire on the transition from "building" → "completed".
    // Other transitions (e.g. completed on first mount via rehydration)
    // don't celebrate — the LD wasn't there to see the build.
    if (prev === "building" && phase === "completed") {
      fireBurst();
    }
  }, [orchestratorState.phase]);

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
