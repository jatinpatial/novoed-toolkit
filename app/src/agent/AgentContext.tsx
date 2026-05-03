import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CaseStudy, Course, CourseShape, Material, QuizQuestion } from "../course/types";
import type { InfographicPoint } from "../store/infographics";
import type { BrandKey } from "../brand/tokens";
import type { BlockData } from "../course/types";
import type {
  BuildProgressKind,
  ChatEntry,
  ConnectionStatus,
  CourseOutlineProposal,
  OrchestratorState,
} from "./types";
import { useAgentSocket } from "./useAgentSocket";

/**
 * WriterBlock — what the Lesson Writer agent emits in its write_lesson
 * tool calls (AI-1a widening).
 *
 * Pre-AI-1a: `{ type, content }` only — content was the entire payload,
 * which silently locked the writer to text blocks. Even when the agent
 * confidently produced "banner" or "callout" types, only `content` made
 * it through to BlockData and title/body/items got dropped.
 *
 * AI-1a widens this so structured blocks can carry their proper shape:
 *   - text-only blocks: { type: "text", content: "Body…" }   (legacy)
 *   - structured blocks: { type, data: { title, body, items, … } }   (new)
 *
 * Either `content` (text-only) or `data` (structured) must be present.
 * The runtime (writeLesson in CourseStudio) merges them into BlockData
 * accordingly. parseWriterBlocks in toolExecutor enforces the shape.
 */
export interface WriterBlock {
  type: string;
  /** Plain content for text-only blocks. Legacy shape; backward-compat. */
  content?: string;
  /** Structured block data — title, body, items, type variant, etc. */
  data?: Partial<BlockData>;
}

// Subset of CaseStudy supplied by the agent — the slot's id is fixed
// when Course Architect plants the placeholder, so design_case_study
// only sends the content.
export type CaseStudyContent = Omit<CaseStudy, "id" | "title">;

export interface AgentActions {
  getCourse: () => Course | null;
  /** Track-B: pending materials uploaded during the brief flow,
      before any course exists. read_materials falls back to these
      when course.materials is empty. Optional — pages that don't
      participate in the brief flow can omit it. */
  getPendingMaterials?: () => Material[];
  navigate: (route: string) => Promise<void> | void;
  setBrand: (brand: BrandKey) => void;
  addModule: (title: string) => { module_id: string };
  addLesson: (moduleId: string, title: string, duration?: number) => { lesson_id: string };
  addBlock: (lessonId: string, blockType: string, data?: Partial<BlockData>) => { block_id: string };
  updateBlock: (blockId: string, data: Partial<BlockData>) => void;
  deleteBlock: (blockId: string) => void;
  reorder: (kind: "module" | "lesson" | "block", id: string, newIndex: number) => void;
  exportLesson: (lessonId: string, format: "scorm" | "json") => void;
  writeLesson: (lessonId: string, blocks: WriterBlock[]) => { ok: boolean; replaced: number; added: number };
  writeScript: (videoBlockId: string, script: string) => { ok: boolean; previousScriptLength: number };
  // Quiz Builder: write or replace a knowledge check on a lesson or module.
  // Returns whether the target was found and whether existing content was
  // replaced (vs first write).
  writeKnowledgeCheck: (
    targetKind: "lesson" | "module",
    targetId: string,
    questions: QuizQuestion[],
  ) => { ok: boolean; replaced: boolean };
  // Quiz Builder: replace one question in place. Used for per-question
  // regeneration. ok=false if the target or the index is missing.
  regenerateQuestion: (
    targetKind: "lesson" | "module",
    targetId: string,
    questionIndex: number,
    question: QuizQuestion,
  ) => { ok: boolean };
  // Case Study Designer: fill content into a slot Course Architect planted.
  // ok=false if the case_study_id doesn't match a known slot.
  designCaseStudy: (caseStudyId: string, content: CaseStudyContent) => { ok: boolean };
  // Track-G: Infographic Builder write path. Writes title + subtitle +
  // structured points onto an Infographic record. ok=false when the
  // infographicId doesn't match a known record (silent-success
  // protection mirroring polish-16b's writeLesson contract).
  writeInfographic?: (
    infographicId: string,
    payload: { title: string; subtitle?: string; points: InfographicPoint[] },
  ) => { ok: boolean };
  setOutlineProposal?: (proposal: CourseOutlineProposal) => void;
  // Used by the "Open script editor" button in AgentChat after a
  // successful write_script. Walks the course tree, finds the block,
  // and pops its drawer open. No-op if the block isn't found.
  openBlockDrawer?: (blockId: string) => void;
}

// What the agent just produced that the LD might want to jump to.
// Cleared when the user sends a new message.
export type AgentTarget = { kind: "script"; blockId: string };

// sprint-2-1: empty-state default for the orchestrator slice, used
// when the FE first connects (before the BE replies to the
// rehydration query) and after a clear. Shape matches the wire
// snapshot exactly so consumers can read it without null checks.
const EMPTY_ORCHESTRATOR_STATE: OrchestratorState = {
  phase: "idle",
  lessonStates: {},
  kcStates: {},
  csStates: {},
  lastCompletedLessonIdx: null,
  totalLessons: 0,
  totalKcs: 0,
  totalCss: 0,
  lastError: null,
};

interface AgentContextValue {
  status: ConnectionStatus;
  messages: ChatEntry[];
  isThinking: boolean;
  // Name of the tool the agent is currently running, if any. Updated on
  // each tool_call event, cleared on done/error. UI uses it to render a
  // tool-aware loading label ("Reading materials…", "Writing the script…")
  // instead of a generic "Thinking…".
  currentTool: string | null;
  // Jump-to target produced by the most recent agent turn, e.g. the
  // video block whose script was just (re)written. AgentChat renders an
  // "Open in editor" button when this is set.
  lastTarget: AgentTarget | null;
  // Trigger the AgentActions handler for `lastTarget` (e.g. open the
  // block drawer). No-op if the target page isn't registered.
  openLastTarget: () => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  sendMessage: (text: string) => void;
  registerActions: (actions: AgentActions) => () => void;
  outlineProposal: CourseOutlineProposal | null;
  setOutlineProposal: (proposal: CourseOutlineProposal) => void;
  clearOutlineProposal: () => void;
  pendingInput: string | null;
  prefillInput: (text: string) => void;
  clearPendingInput: () => void;
  // Track-B (Phase 2 AI #3): pending materials uploaded during the
  // brief-creation flow, before any course exists. read_materials
  // tool falls back to these when course.materials is empty.
  // handleBuildFull migrates them onto course.materials and clears
  // this slice when the course is created.
  pendingMaterials: Material[];
  attachPendingMaterial: (m: Material) => void;
  removePendingMaterial: (id: string) => void;
  clearPendingMaterials: () => void;
  // ── sprint-2-1: orchestrator slice ────────────────────────────────
  // Backend is the single source of truth (locked fork #3). The FE
  // mirrors via build_state events; AgentChat / LessonTile read this
  // slice directly. The lastBuildProgress field is kept around so
  // sprint-2-2 can render the most recent progress event verbatim
  // (e.g. "lesson_started: lesson 4 of 13").
  orchestratorState: OrchestratorState;
  lastBuildProgress: { kind: BuildProgressKind; payload: Record<string, unknown> } | null;
  /** Kick off a full-course build. Backend orchestrator runs sequential
      mini-sessions per lesson / KC / case-study slot. */
  sendBuildFullCourse: (course: Course, shape?: CourseShape) => void;
  /** Resume a paused build from the given lesson index (sprint-2-7). */
  resumeBuild: (startFrom: number) => void;
  /** Set cancellation flag — the build halts at the next phase boundary. */
  cancelBuild: () => void;
  /** Re-fetch the BE's orchestrator snapshot (FE rehydration). The
      socket auto-fires this on every (re)connect; this exposes a
      manual refresh handle for diagnostic use. */
  refreshOrchestratorState: () => void;
  // ── Track-B (KC Studio): standalone KC build slice ─────────────
  /** Per-kcId build status. KC Studio's result page reads this to
      show loading / done / error states. Keyed by kcId so multiple
      builds (rare) can coexist. */
  kcBuilds: Record<
    string,
    | { status: "building" }
    | {
        status: "done";
        durationMs: number;
        costUsd: number | null;
        tokensIn: number | null;
        tokensOut: number | null;
        model: string | null;
      }
    | { status: "failed"; error: string }
  >;
  /** Fire build_kc and set kcBuilds[kcId] = { status: "building" }.
      Returns the kcId for caller convenience. */
  sendBuildKc: (payload: {
    kcId: string;
    topic: string;
    syntheticLessonId: string;
    questionCount: number;
    difficultyMix: ("recall" | "apply" | "analyze")[];
    questionTypes: ("mcq" | "short" | "scenario")[];
    notes?: string;
  }) => void;
  // ── Track-G (Infographic Studio): standalone build slice ───────
  infographicBuilds: Record<
    string,
    | { status: "building" }
    | {
        status: "done";
        durationMs: number;
        costUsd: number | null;
        tokensIn: number | null;
        tokensOut: number | null;
        model: string | null;
      }
    | { status: "failed"; error: string }
  >;
  sendBuildInfographic: (payload: {
    infographicId: string;
    topic: string;
    style: "process" | "quadrant" | "comparison" | "numbered_list" | "timeline";
    pointCount: number;
    notes?: string;
  }) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const WS_URL = (import.meta.env.VITE_AGENT_WS_URL as string | undefined) ?? "ws://127.0.0.1:8766/ws";

export function AgentProvider({ children }: { children: ReactNode }) {
  const actionsRef = useRef<AgentActions | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [lastTarget, setLastTarget] = useState<AgentTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [outlineProposal, setOutlineProposal] = useState<CourseOutlineProposal | null>(null);
  const clearOutlineProposal = useCallback(() => setOutlineProposal(null), []);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  const prefillInput = useCallback((text: string) => setPendingInput(text), []);
  const clearPendingInput = useCallback(() => setPendingInput(null), []);

  // Track-B materials slice. Persisted to localStorage so the brief-
  // form upload survives the navigate to /courses?brief=&autosend=1.
  // Cleared once handleBuildFull migrates onto course.materials.
  const [pendingMaterials, setPendingMaterials] = useState<Material[]>(() => {
    try {
      const raw = window.localStorage.getItem("studio.pendingMaterials");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const persistMaterials = useCallback((next: Material[]) => {
    setPendingMaterials(next);
    try {
      window.localStorage.setItem("studio.pendingMaterials", JSON.stringify(next));
    } catch {
      // localStorage quota / private mode — material lives in-memory
      // for this session, lost on refresh. Acceptable degradation.
    }
  }, []);
  const attachPendingMaterial = useCallback(
    (m: Material) => {
      setPendingMaterials((prev) => {
        const next = [...prev, m];
        try {
          window.localStorage.setItem("studio.pendingMaterials", JSON.stringify(next));
        } catch {
          // ignore — see persistMaterials
        }
        return next;
      });
    },
    [],
  );
  const removePendingMaterial = useCallback(
    (id: string) => {
      setPendingMaterials((prev) => {
        const next = prev.filter((m) => m.id !== id);
        try {
          window.localStorage.setItem("studio.pendingMaterials", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );
  const clearPendingMaterials = useCallback(() => {
    persistMaterials([]);
  }, [persistMaterials]);

  // sprint-2-1: orchestrator slice. Initialized to the empty state
  // and replaced wholesale on each build_state event from the BE.
  // lastBuildProgress holds the most recent build_progress event so
  // sprint-2-2's LessonTile + aggregate progress band can render
  // step-level animations between full state snapshots.
  const [orchestratorState, setOrchestratorState] = useState<OrchestratorState>(EMPTY_ORCHESTRATOR_STATE);
  const [lastBuildProgress, setLastBuildProgress] = useState<
    { kind: BuildProgressKind; payload: Record<string, unknown> } | null
  >(null);
  // Track-B (KC Studio): per-kcId build status. Keyed map so
  // simultaneous builds (rare) coexist. KC Studio result page
  // watches its own kcBuilds[kcId] for status transitions.
  const [kcBuilds, setKcBuilds] = useState<AgentContextValue["kcBuilds"]>({});
  // Track-G: same per-id status map for Infographic Studio builds.
  const [infographicBuilds, setInfographicBuilds] = useState<
    AgentContextValue["infographicBuilds"]
  >({});

  const appendMessage = useCallback((entry: ChatEntry) => {
    setMessages((prev) => [...prev, entry]);
  }, []);

  const updateLastAssistant = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: crypto.randomUUID(), role: "assistant", text }];
    });
  }, []);

  const { status, sendUserMessage, sendRaw } = useAgentSocket({
    url: WS_URL,
    getActions: () => actionsRef.current,
    onAssistantText: (text) => {
      // B3-tune-a: previously cleared isThinking on the FIRST text
      // token. That left the loading indicator dark for 10-20s during
      // long tool runs (write_lesson, write_knowledge_check) when the
      // agent emits a few words of preamble before calling the tool.
      // Indicator now stays visible until onDone (turn complete) or
      // onError fires — so the LD sees a continuous "still working"
      // signal across the whole turn.
      updateLastAssistant(text);
    },
    onToolCall: (name, args) => {
      setCurrentTool(name);
      // Capture jump-to targets from outcome-shaped tool calls.
      if (name === "write_script" && typeof args.video_block_id === "string") {
        setLastTarget({ kind: "script", blockId: args.video_block_id });
      }
      // Tool calls used to land in the chat as a separate "→ tool_name(args)"
      // bubble. That doubled up with the ProgressIndicator (#5b) and read as
      // raw debug noise to LDs — they didn't know whether to wait or do
      // something. The active tool name is already surfaced by the indicator
      // ("Reading the source materials…", "Writing the script…"); after the
      // turn ends, the agent's text response carries the user-facing summary.
      // No more raw bubble. If we ever want a developer/debug view, add a
      // toggle that re-enables this append.
    },
    onError: (message) => {
      setIsThinking(false);
      setCurrentTool(null);
      appendMessage({ id: crypto.randomUUID(), role: "error", text: message });
    },
    onDone: () => {
      setIsThinking(false);
      setCurrentTool(null);
    },
    onBuildState: (state) => {
      setOrchestratorState(state);
    },
    onBuildProgress: (kind, payload) => {
      setLastBuildProgress({ kind, payload });
    },
    onKcBuilt: (payload) => {
      setKcBuilds((prev) => ({
        ...prev,
        [payload.kcId]: {
          status: "done",
          durationMs: payload.durationMs,
          costUsd: payload.costUsd,
          tokensIn: payload.tokensIn,
          tokensOut: payload.tokensOut,
          model: payload.model,
        },
      }));
    },
    onKcBuildFailed: (kcId, error) => {
      setKcBuilds((prev) => ({
        ...prev,
        [kcId]: { status: "failed", error },
      }));
    },
    onInfographicBuilt: (payload) => {
      setInfographicBuilds((prev) => ({
        ...prev,
        [payload.infographicId]: {
          status: "done",
          durationMs: payload.durationMs,
          costUsd: payload.costUsd,
          tokensIn: payload.tokensIn,
          tokensOut: payload.tokensOut,
          model: payload.model,
        },
      }));
    },
    onInfographicBuildFailed: (infographicId, error) => {
      setInfographicBuilds((prev) => ({
        ...prev,
        [infographicId]: { status: "failed", error },
      }));
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      appendMessage({ id: crypto.randomUUID(), role: "user", text });
      setIsThinking(true);
      setCurrentTool(null);
      setLastTarget(null);
      sendUserMessage(text);
    },
    [appendMessage, sendUserMessage],
  );

  const openLastTarget = useCallback(() => {
    const t = lastTarget;
    if (!t) {
      console.warn("[agent] openLastTarget: no lastTarget set");
      return;
    }
    const actions = actionsRef.current;
    if (!actions) {
      // polish-9a: surface the no-actions case so a click on the
      // "Open script editor →" CTA doesn't silently no-op when the
      // page hasn't registered actions (e.g. mid-route-transition).
      console.warn("[agent] openLastTarget: no actions registered");
      return;
    }
    if (t.kind === "script") {
      if (!actions.openBlockDrawer) {
        // polish-9a: fallback when the current page doesn't expose
        // openBlockDrawer (CoursesHome with no course open). The
        // caller's last action created a script block in a course
        // we may not be viewing; navigate to that course's edit
        // route as the most useful fallback. The route handler
        // will pick up &block= and pop the drawer on mount.
        console.warn(
          "[agent] openLastTarget: actions registered but no openBlockDrawer; falling back to navigate",
        );
        if (actions.navigate) {
          actions.navigate(`/courses?block=${t.blockId}`);
        }
        return;
      }
      actions.openBlockDrawer(t.blockId);
    }
  }, [lastTarget]);

  const registerActions = useCallback((actions: AgentActions) => {
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, []);

  // ── sprint-2-1: orchestrator action helpers ──────────────────────
  // Each helper is a thin wrapper around sendRaw that ships a typed
  // ClientMessage. Action effects show up in the UI via build_state /
  // build_progress events the BE pushes back; we don't optimistically
  // mutate orchestratorState here (BE = source of truth).
  const sendBuildFullCourse = useCallback(
    (course: Course, shape?: CourseShape) => {
      sendRaw({ type: "build_full_course", course, shape });
    },
    [sendRaw],
  );
  const resumeBuild = useCallback(
    (startFrom: number) => {
      sendRaw({ type: "build_full_course_resume", startFrom });
    },
    [sendRaw],
  );
  const cancelBuild = useCallback(() => {
    sendRaw({ type: "build_cancel" });
  }, [sendRaw]);
  const refreshOrchestratorState = useCallback(() => {
    sendRaw({ type: "get_orchestrator_state" });
  }, [sendRaw]);

  // Track-B (KC Studio): kick off a standalone KC build. Sets the
  // local kcBuilds[kcId] to "building" optimistically; BE responds
  // with kc_built or kc_build_failed which onKcBuilt / onKcBuildFailed
  // resolves into the slice.
  const sendBuildKc = useCallback(
    (payload: {
      kcId: string;
      topic: string;
      syntheticLessonId: string;
      questionCount: number;
      difficultyMix: ("recall" | "apply" | "analyze")[];
      questionTypes: ("mcq" | "short" | "scenario")[];
      notes?: string;
    }) => {
      setKcBuilds((prev) => ({ ...prev, [payload.kcId]: { status: "building" } }));
      sendRaw({ type: "build_kc", ...payload });
    },
    [sendRaw],
  );

  // Track-G: parallel helper for Infographic Studio builds.
  const sendBuildInfographic = useCallback(
    (payload: {
      infographicId: string;
      topic: string;
      style: "process" | "quadrant" | "comparison" | "numbered_list" | "timeline";
      pointCount: number;
      notes?: string;
    }) => {
      setInfographicBuilds((prev) => ({
        ...prev,
        [payload.infographicId]: { status: "building" },
      }));
      sendRaw({ type: "build_infographic", ...payload });
    },
    [sendRaw],
  );

  const value = useMemo<AgentContextValue>(
    () => ({
      status,
      messages,
      isThinking,
      currentTool,
      lastTarget,
      openLastTarget,
      open,
      setOpen,
      sendMessage,
      registerActions,
      outlineProposal,
      setOutlineProposal,
      clearOutlineProposal,
      pendingInput,
      prefillInput,
      clearPendingInput,
      pendingMaterials,
      attachPendingMaterial,
      removePendingMaterial,
      clearPendingMaterials,
      orchestratorState,
      lastBuildProgress,
      sendBuildFullCourse,
      resumeBuild,
      cancelBuild,
      refreshOrchestratorState,
      kcBuilds,
      sendBuildKc,
      infographicBuilds,
      sendBuildInfographic,
    }),
    [
      status,
      messages,
      isThinking,
      currentTool,
      lastTarget,
      openLastTarget,
      open,
      sendMessage,
      registerActions,
      outlineProposal,
      clearOutlineProposal,
      pendingInput,
      prefillInput,
      clearPendingInput,
      pendingMaterials,
      attachPendingMaterial,
      removePendingMaterial,
      clearPendingMaterials,
      orchestratorState,
      lastBuildProgress,
      sendBuildFullCourse,
      resumeBuild,
      cancelBuild,
      refreshOrchestratorState,
      kcBuilds,
      sendBuildKc,
      infographicBuilds,
      sendBuildInfographic,
    ],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}

export function useRegisterAgentActions(actions: AgentActions) {
  const { registerActions } = useAgent();
  useEffect(() => registerActions(actions), [registerActions, actions]);
}

