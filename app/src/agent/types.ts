import type { Course, CourseShape } from "../course/types";

export type ClientMessage =
  | { type: "user_message"; text: string }
  | { type: "tool_result"; id: string; ok: boolean; result?: unknown; error?: string }
  | { type: "cancel" }
  // ── sprint-2-1: orchestrator routes ──────────────────────────────
  // Client-initiated full-course build. The backend orchestrator
  // (BuildOrchestrator) runs sequential mini-sessions per lesson /
  // KC slot / case-study slot, fanning out from the chat queue so a
  // long build doesn't backpressure chat events. Per locked fork
  // #3, backend state is the single source of truth — the FE
  // rehydrates after a refresh via `get_orchestrator_state`.
  | { type: "build_full_course"; course: Course; shape?: CourseShape }
  | { type: "build_full_course_resume"; startFrom: number }
  | { type: "build_cancel" }
  | { type: "get_orchestrator_state" };

// Phase / per-target status enums — must stay in sync with the
// Python `PhaseStatus` and `TargetStatus` literals in
// agent_backend/orchestrator.py.
export type OrchestratorPhase =
  | "idle"
  | "building"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";
export type OrchestratorTargetStatus = "idle" | "building" | "done" | "error";

// Wire-format snapshot of the backend orchestrator state. Keys
// match OrchestratorState.to_dict() in orchestrator.py exactly.
export interface OrchestratorState {
  phase: OrchestratorPhase;
  /** Per-lesson states, keyed by absolute lesson index across the course. */
  lessonStates: Record<string, OrchestratorTargetStatus>;
  /** Per-knowledge-check states (sprint-2-8). Keyed by lesson_id or module_id. */
  kcStates: Record<string, OrchestratorTargetStatus>;
  /** Per-case-study states (sprint-2-9). Keyed by case-study slot id. */
  csStates: Record<string, OrchestratorTargetStatus>;
  /** Index of the most recently completed lesson, or null when nothing done. */
  lastCompletedLessonIdx: number | null;
  totalLessons: number;
  totalKcs: number;
  totalCss: number;
  lastError: string | null;
}

// Progress-event kinds the orchestrator emits. `not_implemented`
// is the sprint-2-1 stub-only kind so the FE confirms the wire
// works end-to-end before sprint-2-3 lands the real lesson loop.
// `lesson_retrying` (sprint-2-6) carries attempt/maxAttempts on the
// payload so the band can render "Retrying lesson N (attempt 2/2)…".
export type BuildProgressKind =
  | "lesson_started"
  | "lesson_completed"
  | "lesson_failed"
  | "lesson_retrying"
  | "kc_started"
  | "kc_completed"
  | "kc_failed"
  | "kc_retrying"
  | "cs_started"
  | "cs_completed"
  | "cs_failed"
  | "course_completed"
  | "course_export_ready"
  | "not_implemented";

export type ServerMessage =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "done"; usage?: Record<string, unknown> | null }
  | { type: "error"; message: string }
  // ── sprint-2-1: orchestrator events ──────────────────────────────
  // `build_state` is the full snapshot — emitted after every state
  // transition and on `get_orchestrator_state` requests.
  // `build_progress` is per-step; carries `kind` + step-specific
  // payload (e.g. `lessonIdx`, `lessonId`, `error`, `message`).
  | { type: "build_state"; state: OrchestratorState }
  | ({ type: "build_progress"; kind: BuildProgressKind } & Record<string, unknown>);

export interface ChatEntry {
  id: string;
  role: "user" | "assistant" | "tool" | "error";
  text: string;
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

export interface ProposedLesson {
  title: string;
  durationMin?: number;
  objectives?: string[];
}

export interface ProposedModule {
  weekNumber: number;
  title: string;
  summary?: string;
  objectives?: string[];
  lessons: ProposedLesson[];
  // Title for a case-study slot Course Architect wants this module to
  // anchor on (typically 2-3 modules per course get a slot). Slot is
  // planted empty — Case Study Designer fills the content later.
  caseStudyTitle?: string;
}

export interface CourseOutlineProposal {
  title: string;
  audience?: string;
  durationWeeks: number;
  modules: ProposedModule[];
  // polish-3d: course-shape constraints from the LD's structured brief.
  // Course Architect parses "Course shape: …" sections from the brief
  // and forwards the values via this field on propose_course_outline.
  // buildCourseFromProposal copies them onto Course.shape so Lesson
  // Writer reads them on subsequent turns via list_structure.
  shape?: CourseShape;
}
