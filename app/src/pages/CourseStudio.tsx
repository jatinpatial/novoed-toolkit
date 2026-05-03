import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, X, MoreHorizontal, ArrowUp, ArrowDown, ArrowRight, Trash2, Copy, Settings2, ChevronLeft, ChevronRight,
  Save, Check, Download, FileJson, FileText, Eye, Sparkles, MessageSquare, BookOpen, PlayCircle, Home, Type,
  Video, Image as ImageIcon, Rows3, Hash, ListChecks, Layers, Clock, HelpCircle, BarChart3, Minus, AlertCircle,
  Maximize2, Minimize2, LucideProps,
  // AI-1b: section-header icon vocabulary. The 12 names map 1:1 to
  // SECTION_ICON_NAMES in app/src/course/blockTypes.ts. Out-of-set
  // names fall back to BookOpen at render time.
  Target, Brain, Pencil, Quote, CheckCircle2, Lightbulb, TrendingUp, Users,
  type LucideIcon,
} from "lucide-react";
import { Sidebar } from "../shell/Sidebar";
import { TopBar, useActiveBrand } from "../shell/TopBar";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { B, esc, type BrandKey } from "../brand/tokens";
import { BTYPES, BDEFAULTS } from "../course/blockTypes";
import { previewBlock, renderTextBlockBody } from "../course/previewBlock";
import { renderInlineMd } from "../course/renderInlineMarkdown";
import { exportLessonSCORM, exportCourseJSON, exportOutlineText } from "../course/exportLesson";
import type { Block, BlockData, BlockItem, CaseStudy, Course, Lesson, Material, Module, Quiz, QuizQuestion } from "../course/types";
import { deleteProject, getProject, listProjects, saveProject, subscribeProjects, uid, type Project } from "../store/projects";
import { AgentProvider, useAgent, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import { AgentChat, AgentInflightIndicator } from "../agent/AgentChat";
import { CourseOutlineProposalCard } from "../agent/CourseOutlineProposal";
import { BuildCompletionConfetti, BuildProgressBand, LessonTile } from "../agent/LessonTile";
import { MaterialsShelf } from "../agent/MaterialsShelf";
import type { CourseOutlineProposal } from "../agent/types";

/* ── small helpers ───────────────────────────────────────────────────────── */
const rid = () => "b" + Math.random().toString(36).slice(2, 10);

function toast(msg: string, ok = true) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:" + (ok ? "#197A56" : "#dc2626") + ";color:#fff;padding:10px 22px;border-radius:999px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);white-space:nowrap;";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.cssText += ";opacity:0;transition:opacity 0.4s;"; }, 1600);
  setTimeout(() => { t.parentNode && t.parentNode.removeChild(t); }, 2100);
}

function makeCourse(brand: BrandKey): Course {
  return {
    id: rid(),
    title: "Untitled Course",
    client: "",
    brand,
    modules: [{
      id: rid(),
      title: "Module 1",
      lessons: [{ id: rid(), title: "1.1 Introduction", duration: 5, blocks: [] }],
    }],
  };
}

function buildCourseFromProposal(proposal: CourseOutlineProposal, brand: BrandKey): Course {
  // First pass: build modules + collect case-study slots.
  // Case Study Designer fills content later; the slot just needs id+title
  // here so Course Architect's "leave 2-3 slots" promise is structurally
  // visible from the moment the course is built.
  const caseStudies: { id: string; title: string }[] = [];
  const modules: Module[] = proposal.modules.map((m) => {
    let caseStudyId: string | undefined;
    if (m.caseStudyTitle && m.caseStudyTitle.trim()) {
      caseStudyId = rid();
      caseStudies.push({ id: caseStudyId, title: m.caseStudyTitle.trim() });
    }
    return {
      id: rid(),
      title: m.title,
      weekNumber: m.weekNumber,
      summary: m.summary,
      objectives: m.objectives,
      caseStudyId,
      lessons: m.lessons.map((l) => ({
        id: rid(),
        title: l.title,
        duration: l.durationMin ?? 10,
        blocks: [],
        objectives: l.objectives,
      })),
    };
  });
  return {
    id: rid(),
    title: proposal.title,
    client: "",
    brand,
    modules,
    caseStudies: caseStudies.map((cs) => ({
      ...cs,
      context: "",
      stakeholders: [],
      decisionPoints: [],
      debriefPrompts: [],
    })),
    // polish-3d: copy course-shape constraints from the proposal.
    // Persisted on Course so Lesson Writer reads them on subsequent
    // turns via list_structure (course.shape surfaced by
    // summarizeCourse in toolExecutor.ts).
    shape: proposal.shape,
  };
}

function newItem(type: string): BlockItem {
  if (type === "quiz") return { title: "New option", desc: "0" };
  if (type === "poll") return { title: "New option", desc: "25" };
  if (type === "flipcard") return { title: "New card", img: "", desc: "Flip side content" };
  return { title: "New item", desc: "" };
}

const BLOCK_ICON: Record<string, React.ComponentType<LucideProps>> = {
  text: Type, video: Video, image: ImageIcon, banner: Sparkles, callout: AlertCircle,
  cards: Rows3, stats: Hash, accordion: ListChecks, flipcard: Layers, timeline: Clock,
  quiz: HelpCircle, poll: BarChart3, divider: Minus,
};

function BlockIcon({ type, size = 14 }: { type: string; size?: number }) {
  const Ic = BLOCK_ICON[type] || Type;
  return <Ic size={size} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOP-LEVEL
   ═══════════════════════════════════════════════════════════════════════════ */
export default function CourseStudio() {
  return (
    <AgentProvider>
      <CourseStudioInner />
    </AgentProvider>
  );
}

function CourseStudioInner() {
  const [brand, setBrand] = useActiveBrand();
  const [params, setParams] = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const loadedProjectRef = useRef<string | null>(null);

  const urlProjectId = params.get("project");

  // Load project from URL — ONLY when the project id in the URL actually changes.
  // Without the ref guard, this effect re-fires on every render (because setBrand
  // and setParams are fresh refs), overwriting in-memory edits with the last-saved
  // version from localStorage and wiping newly-added blocks.
  useEffect(() => {
    if (!urlProjectId) {
      if (loadedProjectRef.current !== null) {
        setCourse(null);
        setProjectId(null);
        loadedProjectRef.current = null;
      }
      return;
    }
    if (loadedProjectRef.current === urlProjectId) return;

    const p = getProject(urlProjectId);
    if (p && p.data.kind === "course") {
      setCourse(p.data.course);
      setProjectId(p.id);
      setBrand(p.brand);
      loadedProjectRef.current = p.id;
    } else {
      setCourse(null);
      setProjectId(null);
      loadedProjectRef.current = null;
      setParams((prev) => { const n = new URLSearchParams(prev); n.delete("project"); return n; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // Autosave
  useEffect(() => {
    if (!course || !projectId) return;
    const t = setTimeout(() => {
      saveProject({
        id: projectId,
        name: course.title,
        kind: "course",
        brand: course.brand,
        data: { kind: "course", course },
      });
    }, 500);
    return () => clearTimeout(t);
  }, [course, projectId]);

  function openCourse(newCourse: Course, newId: string) {
    loadedProjectRef.current = newId;
    setCourse(newCourse);
    setProjectId(newId);
    setParams({ project: newId }, { replace: false });
  }

  function closeCourse() {
    loadedProjectRef.current = null;
    setCourse(null);
    setProjectId(null);
    setParams((prev) => { const n = new URLSearchParams(prev); n.delete("project"); return n; }, { replace: true });
  }

  if (!course) return <CoursesHome onOpen={openCourse} brand={brand} />;
  return <CourseCanvas course={course} setCourse={setCourse} projectId={projectId!} onClose={closeCourse} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COURSES HOME — list + create/import
   ═══════════════════════════════════════════════════════════════════════════ */
function CoursesHome({ onOpen, brand }: { onOpen: (c: Course, id: string) => void; brand: BrandKey }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [params, setParams] = useSearchParams();
  const { outlineProposal, setOutlineProposal, clearOutlineProposal, setOpen: setChatOpen, prefillInput, sendMessage, status: agentStatus, sendBuildFullCourse } = useAgent();

  // Brief handoff from the Dashboard hero composer (Phase 2 #1c) +
  // /courses/new structured intake form (C0).
  //
  // polish-2a bug 2: if `&autosend=1` is set, fire sendMessage directly
  // once the agent socket is open — Course Architect runs without the
  // LD clicking Send a second time. Pre-polish-2 the brief always
  // prefilled the textarea and waited; for both the dashboard composer
  // and the form, that second click was friction without value.
  //
  // Effect re-runs when status changes (connecting -> open) so the
  // brief gets sent on the FIRST opportunity. Params are only cleared
  // AFTER successful handling so a slow socket connect doesn't drop
  // the brief mid-mount.
  useEffect(() => {
    const brief = params.get("brief");
    const autosend = params.get("autosend") === "1";
    if (!brief) return;

    setChatOpen(true);

    if (autosend) {
      // Wait for the agent socket to be open before sending. Once
      // status flips to "open" the effect re-runs and we land here.
      if (agentStatus !== "open") return;
      sendMessage(brief);
    } else {
      // Legacy path — prefill, let the LD review and press Enter.
      prefillInput(brief);
    }

    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("brief");
        n.delete("autosend");
        return n;
      },
      { replace: true },
    );
  }, [params, agentStatus, setParams, setChatOpen, prefillInput, sendMessage]);

  useEffect(() => {
    const refresh = () => setProjects(listProjects().filter((p) => p.kind === "course"));
    refresh();
    return subscribeProjects(refresh);
  }, []);

  const homeAgentActions = useMemo<AgentActions>(() => ({
    getCourse: () => null,
    navigate: () => {},
    setBrand: () => {},
    addModule: () => { throw new Error("No course is open. Call propose_course_outline; the LD will build the course from there."); },
    addLesson: () => { throw new Error("No course is open."); },
    addBlock: () => { throw new Error("No course is open."); },
    updateBlock: () => { throw new Error("No course is open."); },
    deleteBlock: () => { throw new Error("No course is open."); },
    reorder: () => {},
    exportLesson: () => {},
    writeLesson: () => { throw new Error("No course is open. Open a course before asking for a lesson to be written."); },
    writeScript: () => { throw new Error("No course is open. Open a course and add a video block before asking for a script."); },
    writeKnowledgeCheck: () => { throw new Error("No course is open. Open a course before asking for a knowledge check."); },
    regenerateQuestion: () => { throw new Error("No course is open. Open a course before regenerating questions."); },
    designCaseStudy: () => { throw new Error("No course is open. Open a course (Course Architect plants the case-study slots) before asking to design one."); },
    setOutlineProposal: (proposal) => {
      setOutlineProposal(proposal);
      setChatOpen(true);
    },
  }), [setOutlineProposal, setChatOpen]);

  useRegisterAgentActions(homeAgentActions);

  function handleNew() {
    const course = makeCourse(brand);
    const id = uid();
    saveProject({ id, name: course.title, kind: "course", brand, data: { kind: "course", course } });
    onOpen(course, id);
  }

  function handleBuild(edited?: CourseOutlineProposal) {
    // AI-1-polish-C bug 8: the proposal card now passes its locally-
    // edited copy on Build. Falls back to the unedited outlineProposal
    // when called without args (defensive — current callers always
    // pass `edited`).
    const proposalToBuild = edited ?? outlineProposal;
    if (!proposalToBuild) return;
    const course = buildCourseFromProposal(proposalToBuild, brand);
    const id = uid();
    saveProject({ id, name: course.title, kind: "course", brand, data: { kind: "course", course } });
    clearOutlineProposal();
    onOpen(course, id);
    toast("Course built — fill in the lessons next");
  }

  // sprint-2-1: Build full course — same shell as handleBuild, then
  // immediately fires build_full_course on the WS so the orchestrator
  // runs sequential mini-sessions per lesson / KC / case-study slot.
  // Sprint-2-1 ships the wire only — the orchestrator answers with a
  // `not_implemented` build_progress event for now. Sprint-2-3 swaps
  // the stub for the real lesson loop.
  function handleBuildFull(edited?: CourseOutlineProposal) {
    const proposalToBuild = edited ?? outlineProposal;
    if (!proposalToBuild) return;
    const course = buildCourseFromProposal(proposalToBuild, brand);
    const id = uid();
    saveProject({ id, name: course.title, kind: "course", brand, data: { kind: "course", course } });
    clearOutlineProposal();
    onOpen(course, id);
    // Fire-and-forget — the BE orchestrator pushes build_state /
    // build_progress events back as work proceeds; AgentContext
    // mirrors them into orchestratorState for the UI to read.
    sendBuildFullCourse(course, course.shape);
    toast("Building full course — track progress in Studio Copilot");
  }

  // AI-1-polish-C bug 9: dismiss the proposal AND open the chat with
  // a "Refine the outline: " prefill. For structural changes the LD
  // can't easily make via inline cell edits — merge modules, change
  // duration, swap topic emphasis, etc. AgentChat's polish-A auto-
  // collapse only fires when outlineProposal becomes non-null; we're
  // setting it null here so the chat can re-open without a fight.
  function handleRefine() {
    clearOutlineProposal();
    setChatOpen(true);
    prefillInput("Refine the outline: ");
  }

  function handleImport() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        try {
          const c = JSON.parse(ev.target!.result as string) as Course;
          if (!c.modules) throw new Error("Not a valid course file");
          const id = uid();
          saveProject({ id, name: c.title, kind: "course", brand: c.brand, data: { kind: "course", course: c } });
          onOpen(c, id);
          toast("Imported " + c.title);
        } catch {
          toast("Could not read that file", false);
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          <PageHeader
            eyebrow="Course Studio"
            title="Your courses."
            subtitle="Open a course to keep working, or start a new one from the dashboard brief composer."
            actions={
              <>
                <button onClick={handleImport} className="btn-secondary btn-sm"><FileJson size={14} /> Import JSON</button>
                <Link to="/" className="btn-primary btn-sm"><Sparkles size={14} /> New course</Link>
              </>
            }
          />

          {outlineProposal && (
            <div className="mb-6">
              <CourseOutlineProposalCard
                proposal={outlineProposal}
                onBuild={handleBuild}
                /* sprint-2-1: only expose the full-course build button
                   when the agent socket is open. Backend offline →
                   button hidden so the LD doesn't fire into a void. */
                onBuildFull={agentStatus === "open" ? handleBuildFull : undefined}
                onDiscard={clearOutlineProposal}
                onRefine={handleRefine}
              />
            </div>
          )}

          {!outlineProposal && projects.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={24} />}
              title="No courses yet"
              description="Type your brief on the dashboard — topic, audience, duration. Course Architect proposes a weekly outline you can build with one click."
              action={
                <div className="flex flex-col items-center gap-3">
                  <Link to="/" className="btn-primary btn-sm"><Sparkles size={14} /> Open dashboard</Link>
                  <div className="flex gap-3 text-[11px] text-ink-400">
                    <button onClick={handleImport} className="hover:text-brand-700 underline-offset-2 hover:underline">
                      Import JSON
                    </button>
                    <span>·</span>
                    <button onClick={handleNew} className="hover:text-brand-700 underline-offset-2 hover:underline">
                      Start blank
                    </button>
                  </div>
                </div>
              }
            />
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((p) => {
                if (p.data.kind !== "course") return null;
                const c = p.data.course;
                const mods = c.modules.length;
                const lessons = c.modules.reduce((s, m) => s + m.lessons.length, 0);
                const blocks = c.modules.reduce((s, m) => s + m.lessons.reduce((ss, l) => ss + l.blocks.length, 0), 0);
                return (
                  <div key={p.id} className="card card-hover group overflow-hidden">
                    <button
                      onClick={() => { onOpen(c, p.id); }}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-600 flex items-center justify-center">
                          <BookOpen size={14} />
                        </div>
                        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">{p.brand}</span>
                        <span className="text-[10px] text-ink-300 ml-auto">{new Date(p.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm font-semibold text-ink-900 mb-1 truncate">{c.title}</div>
                      <div className="text-xs text-ink-500">{mods} module{mods !== 1 ? "s" : ""} · {lessons} lesson{lessons !== 1 ? "s" : ""} · {blocks} block{blocks !== 1 ? "s" : ""}</div>
                    </button>
                    <div className="flex items-center border-t border-ink-100 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { if (confirm("Delete " + c.title + "?")) deleteProject(p.id); }}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </main>
      </div>
      <FloatingCopilot />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COURSE CANVAS — full-bleed editor
   ═══════════════════════════════════════════════════════════════════════════ */
interface CanvasProps {
  course: Course;
  setCourse: (c: Course) => void;
  projectId: string;
  onClose: () => void;
}

function CourseCanvas({ course, setCourse, projectId, onClose }: CanvasProps) {
  const [am, setAm] = useState(0);
  const [al, setAl] = useState(0);
  // polish-9e: scroll the lesson canvas pane to top whenever the
  // active lesson changes — both via the Continue CTA AND via outline-
  // row clicks. Pre-polish-9e the pane held the previous lesson's
  // scroll position, so navigating to lesson 2 mid-lesson left the
  // LD on the new lesson's body section instead of its opener. The
  // ref is attached to .lesson-canvas-pane below; the effect smooth-
  // scrolls on (am, al, viewMode) change.
  const canvasPaneRef = useRef<HTMLDivElement | null>(null);

  // polish-3c: brief + autosend handler for navigations into an
  // already-loaded course. Mirrors the CoursesHome handler from
  // polish-2a, but runs when the course IS loaded — covers the
  // /scripts/new -> save course -> navigate(/courses?project=X&brief=Y&autosend=1)
  // flow. Without this, the brief sat in the URL but never reached
  // the agent (CoursesHome's handler doesn't run with project loaded).
  const [canvasParams, setCanvasParams] = useSearchParams();
  const { setOpen: setChatOpen, prefillInput, sendMessage, status: agentStatus, lastBuildProgress } = useAgent();
  useEffect(() => {
    const brief = canvasParams.get("brief");
    const autosend = canvasParams.get("autosend") === "1";
    if (!brief) return;
    setChatOpen(true);
    if (autosend) {
      if (agentStatus !== "open") return; // wait for socket
      sendMessage(brief);
    } else {
      prefillInput(brief);
    }
    setCanvasParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("brief");
        n.delete("autosend");
        return n;
      },
      { replace: true },
    );
  }, [canvasParams, agentStatus, setCanvasParams, setChatOpen, prefillInput, sendMessage]);
  // Canvas mode. "lesson" shows the lesson editor; "module" shows the
  // module summary page (week/objectives/final assessment/case study).
  // Switched by clicking the module row vs a lesson row in the outline.
  const [viewMode, setViewMode] = useState<"lesson" | "module">("lesson");

  // sprint-2-9: auto-download the course as a Word doc when the
  // orchestrator emits course_export_ready (fires after lessons +
  // KCs + case studies all finish cleanly). Closes the "click → file
  // downloaded" loop the demo promises.
  //
  // The existing onExportCourseDocx callback in TopBar holds the
  // canonical download flow; this effect reproduces it inline so it
  // can fire without the TopBar being mounted (e.g. mobile / narrow
  // layouts that hide the export menu). The fired-once ref prevents
  // re-trigger on re-renders or rehydration.
  const courseDocxFiredRef = useRef(false);
  useEffect(() => {
    if (lastBuildProgress?.kind === "lesson_started" &&
        lastBuildProgress.payload.idx === 0) {
      // New build → re-arm.
      courseDocxFiredRef.current = false;
      return;
    }
    if (lastBuildProgress?.kind !== "course_export_ready") return;
    if (courseDocxFiredRef.current) return;
    courseDocxFiredRef.current = true;
    // Fire-and-forget — toast on success/failure.
    (async () => {
      try {
        const res = await fetch(`${HTTP_URL}/export/course-docx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course, audience: "" }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `server returned ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const stem = `${course.title || "course"}-course`.replace(/[^\w\-_.]/g, "_");
        a.download = `${stem}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Course downloaded as Word doc");
      } catch (e) {
        toast(`Auto-download failed: ${(e as Error).message}`, false);
      }
    })();
  }, [lastBuildProgress, course]);

  // polish-9e: scroll the canvas pane back to top on every lesson /
  // module change. Smooth so it reads as "moved to next lesson"
  // rather than a hard cut. Skipped on the very first mount (the
  // ref hasn't attached yet at that point — initial-render scroll
  // top is already 0).
  useEffect(() => {
    canvasPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [am, al, viewMode]);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [leftPane, setLeftPane] = useState<"outline" | "materials">("outline");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const mod = course.modules[am] || course.modules[0];
  const lesson = mod?.lessons[al] || mod?.lessons[0];
  const moduleCaseStudy = mod?.caseStudyId
    ? (course.caseStudies ?? []).find((cs) => cs.id === mod.caseStudyId)
    : undefined;

  /* ── mutations ─────────────────────────────────────────────────────────── */
  const mutate = useCallback((fn: (draft: Course) => void) => {
    const next = JSON.parse(JSON.stringify(course)) as Course;
    fn(next);
    setCourse(next);
  }, [course, setCourse]);

  const patchLesson = useCallback((fn: (l: Lesson) => void) => {
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (l) fn(l);
    });
  }, [am, al, mutate]);

  const addMaterial = useCallback((m: Material) => {
    mutate((c) => { c.materials = [...(c.materials ?? []), m]; });
  }, [mutate]);

  const removeMaterial = useCallback((id: string) => {
    mutate((c) => { c.materials = (c.materials ?? []).filter((x) => x.id !== id); });
  }, [mutate]);

  const patchBlock = useCallback((id: string, fn: (b: Block) => void) => {
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (!l) return;
      const b = l.blocks.find((x) => x.id === id);
      if (b) fn(b);
    });
  }, [am, al, mutate]);

  function addBlock(type: string, atIndex?: number) {
    const blk: Block = { id: rid(), type, data: JSON.parse(JSON.stringify(BDEFAULTS[type] || {})) };
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (!l) return;
      const pos = atIndex ?? l.blocks.length;
      l.blocks.splice(pos, 0, blk);
    });
    setInsertAt(null);
    if (["cards", "stats", "accordion", "flipcard", "timeline", "quiz", "poll"].includes(type)) {
      setEditingBlockId(blk.id);
    }
  }

  function removeBlock(id: string) {
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (l) l.blocks = l.blocks.filter((b) => b.id !== id);
    });
    if (editingBlockId === id) setEditingBlockId(null);
  }

  function duplicateBlock(id: string) {
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (!l) return;
      const i = l.blocks.findIndex((b) => b.id === id);
      if (i < 0) return;
      const copy: Block = { ...l.blocks[i], id: rid(), data: JSON.parse(JSON.stringify(l.blocks[i].data)) };
      l.blocks.splice(i + 1, 0, copy);
    });
  }

  function moveBlock(id: string, dir: -1 | 1) {
    mutate((c) => {
      const l = c.modules[am]?.lessons[al];
      if (!l) return;
      const i = l.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.blocks.length) return;
      [l.blocks[i], l.blocks[j]] = [l.blocks[j], l.blocks[i]];
    });
  }

  /* ── agent integration ────────────────────────────────────────────────── */
  const agentActions = useMemo<AgentActions>(() => ({
    getCourse: () => course,
    navigate: () => {},
    setBrand: (b) => { mutate((c) => { c.brand = b; }); },
    addModule: (title) => {
      const id = rid();
      mutate((c) => {
        c.modules.push({ id, title, lessons: [{ id: rid(), title: (c.modules.length + 1) + ".1 New Lesson", duration: 5, blocks: [] }] });
      });
      return { module_id: id };
    },
    addLesson: (moduleId, title, duration = 5) => {
      const id = rid();
      mutate((c) => {
        const m = c.modules.find((x) => x.id === moduleId);
        if (m) m.lessons.push({ id, title, duration, blocks: [] });
      });
      return { lesson_id: id };
    },
    addBlock: (lessonId, blockType, data) => {
      const id = rid();
      mutate((c) => {
        c.modules.forEach((m) => m.lessons.forEach((l) => {
          if (l.id === lessonId) {
            const base = JSON.parse(JSON.stringify(BDEFAULTS[blockType] || {}));
            l.blocks.push({ id, type: blockType, data: { ...base, ...(data || {}) } });
          }
        }));
      });
      return { block_id: id };
    },
    updateBlock: (blockId, data) => {
      mutate((c) => {
        c.modules.forEach((m) => m.lessons.forEach((l) => l.blocks.forEach((b) => {
          if (b.id === blockId) b.data = { ...b.data, ...data };
        })));
      });
    },
    deleteBlock: (blockId) => {
      mutate((c) => {
        c.modules.forEach((m) => m.lessons.forEach((l) => {
          l.blocks = l.blocks.filter((b) => b.id !== blockId);
        }));
      });
    },
    reorder: () => {},
    exportLesson: (lessonId, format) => {
      c: for (const m of course.modules) for (const l of m.lessons) if (l.id === lessonId) {
        if (format === "scorm") exportLessonSCORM(course, l);
        else exportCourseJSON(course);
        break c;
      }
    },
    writeLesson: (lessonId, blocks) => {
      // Fallback: if the agent passes a display label like "1.1" instead of a
      // real lesson id, resolve it positionally to modules[M-1].lessons[L-1].id.
      let resolvedId = lessonId;
      const labelMatch = /^(\d+)\.(\d+)$/.exec(lessonId.trim());
      if (labelMatch) {
        const mi = parseInt(labelMatch[1], 10) - 1;
        const li = parseInt(labelMatch[2], 10) - 1;
        const fallback = course.modules[mi]?.lessons[li]?.id;
        if (fallback) resolvedId = fallback;
      }

      let replaced = 0;
      let added = 0;
      mutate((c) => {
        c.modules.forEach((m) => m.lessons.forEach((l) => {
          if (l.id !== resolvedId) return;
          const before = l.blocks.length;
          l.blocks = l.blocks.filter((b) => b.source !== "writer");
          replaced = before - l.blocks.length;
          for (const b of blocks) {
            // AI-1a: if the agent passed structured `data`, use it
            // verbatim (banner.title+body, callout.body+type, accordion.
            // items, etc.). Fall back to { content } for text-only
            // blocks. Pre-AI-1a always wrote { content: b.content },
            // which dropped every structured field on the floor.
            const blockData: BlockData = b.data
              ? { ...b.data }
              : { content: b.content ?? "" };
            l.blocks.push({
              id: rid(),
              type: b.type,
              data: blockData,
              source: "writer",
            });
            added += 1;
          }
        }));
      });
      return { replaced, added };
    },
    writeScript: (videoBlockId, script) => {
      let ok = false;
      let previousScriptLength = 0;
      mutate((c) => {
        for (const m of c.modules) {
          for (const l of m.lessons) {
            for (const b of l.blocks) {
              if (b.id === videoBlockId && b.type === "video") {
                previousScriptLength = (b.data.script ?? "").length;
                b.data.script = script;
                ok = true;
                return;
              }
            }
          }
        }
      });
      return { ok, previousScriptLength };
    },
    openBlockDrawer: (blockId) => {
      // Walk the course tree to find the block, switch the canvas to
      // its lesson, and pop the drawer open. Used by AgentChat's
      // "Open script editor" button after a successful write_script.
      //
      // polish-9a: pre-fix this returned silently when the block
      // wasn't found in the current course tree, so the JumpButton
      // click looked like nothing happened. Now we toast the miss
      // — the LD at least knows the click registered.
      for (let mi = 0; mi < course.modules.length; mi++) {
        const m = course.modules[mi];
        for (let li = 0; li < m.lessons.length; li++) {
          const l = m.lessons[li];
          if (l.blocks.some((b) => b.id === blockId)) {
            setAm(mi);
            setAl(li);
            setEditingBlockId(blockId);
            // polish-9a: scroll the canvas pane to top so the block
            // drawer opens against a fresh view, not whatever scroll
            // position the previous lesson held.
            requestAnimationFrame(() => {
              canvasPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            });
            return;
          }
        }
      }
      console.warn(
        "[agent] openBlockDrawer: block %s not found in current course",
        blockId,
      );
      toast(
        "Could not find that block in the open course — it may have been deleted or belongs to a different course.",
        false,
      );
    },
    writeKnowledgeCheck: (targetKind, targetId, questions) => {
      let ok = false;
      let replaced = false;
      mutate((c) => {
        if (targetKind === "lesson") {
          for (const m of c.modules) {
            for (const l of m.lessons) {
              if (l.id === targetId) {
                replaced = !!l.knowledgeCheck;
                l.knowledgeCheck = { questions };
                ok = true;
                return;
              }
            }
          }
        } else {
          for (const m of c.modules) {
            if (m.id === targetId) {
              replaced = !!m.knowledgeCheck;
              m.knowledgeCheck = { questions };
              ok = true;
              return;
            }
          }
        }
      });
      return { ok, replaced };
    },
    regenerateQuestion: (targetKind, targetId, questionIndex, question) => {
      let ok = false;
      mutate((c) => {
        const target = (() => {
          if (targetKind === "lesson") {
            for (const m of c.modules) {
              for (const l of m.lessons) if (l.id === targetId) return l;
            }
            return undefined;
          }
          return c.modules.find((m) => m.id === targetId);
        })();
        if (!target?.knowledgeCheck) return;
        const qs = target.knowledgeCheck.questions;
        if (questionIndex < 0 || questionIndex >= qs.length) return;
        qs[questionIndex] = question;
        ok = true;
      });
      return { ok };
    },
    designCaseStudy: (caseStudyId, content) => {
      let ok = false;
      mutate((c) => {
        const slot = (c.caseStudies ?? []).find((cs) => cs.id === caseStudyId);
        if (!slot) return;
        slot.context = content.context;
        slot.stakeholders = content.stakeholders;
        slot.decisionPoints = content.decisionPoints;
        slot.debriefPrompts = content.debriefPrompts;
        ok = true;
      });
      return { ok };
    },
  }), [course, mutate]);

  useRegisterAgentActions(agentActions);

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col bg-ink-50">
      <CourseTopBar
        course={course}
        lesson={lesson}
        onTitleChange={(v: string) => mutate((c) => { c.title = v; })}
        onBrandChange={(b: BrandKey) => mutate((c) => { c.brand = b; })}
        onPreview={() => setPreviewOpen(true)}
        onExportScorm={() => { if (lesson) { exportLessonSCORM(course, lesson); toast("SCORM package downloaded"); } }}
        onExportJson={() => { exportCourseJSON(course); toast("JSON downloaded"); }}
        onExportOutline={() => { exportOutlineText(course); toast("Outline downloaded"); }}
        onExportCourseDocx={async () => {
          // POST the whole course tree to the backend; receive a .docx blob;
          // trigger download. Mirrors the script and case-study download
          // pattern from #4j / #5j.
          try {
            const res = await fetch(`${HTTP_URL}/export/course-docx`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ course, audience: "" }),
            });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(detail || `server returned ${res.status}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const stem = `${course.title || "course"}-course`.replace(/[^\w\-_.]/g, "_");
            a.download = `${stem}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast("Course downloaded as Word doc");
          } catch (e) {
            toast(`Course download failed: ${(e as Error).message}`, false);
          }
        }}
        onClose={onClose}
        projectId={projectId}
      />

      <div className="flex-1 min-h-0 flex">
        {/* Left sidebar — Outline / Materials */}
        {outlineOpen && (
          <LeftSidebar
            course={course}
            am={am} al={al}
            viewMode={viewMode}
            leftPane={leftPane}
            setLeftPane={setLeftPane}
            onSelect={(mi: number, li: number) => { setAm(mi); setAl(li); setViewMode("lesson"); setEditingBlockId(null); }}
            onSelectModule={(mi: number) => { setAm(mi); setViewMode("module"); setEditingBlockId(null); }}
            onUpdate={mutate}
            onCollapse={() => setOutlineOpen(false)}
            onAddMaterial={addMaterial}
            onRemoveMaterial={removeMaterial}
          />
        )}
        {!outlineOpen && (
          <button
            onClick={() => setOutlineOpen(true)}
            title="Open sidebar"
            className="w-8 bg-white border-r border-ink-200 flex flex-col items-center justify-start pt-4 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Canvas — B3c adds .lesson-canvas-pane for the 3px brand-
            cascade top accent strip. The strip color flips when
            the user toggles the brand (B3d wires <body data-brand>),
            giving an instant visible signal of the active theme.
            polish-9e: ref attached so the lesson-change effect can
            scroll this pane (not the window) back to top. */}
        <div ref={canvasPaneRef} className="flex-1 min-w-0 overflow-y-auto lesson-canvas-pane">
          {/* sprint-2-2: aggregate build-progress band. Sticky at the
              top of THIS pane so it scrolls with the lesson body but
              stays visible. Returns null at rest — only renders when
              orchestratorState.phase === "building". */}
          <BuildProgressBand />
          {/* polish-7c: course_completed celebration. Returns null —
              effect-host that fires confetti when the build's real
              course_completed progress event arrives. Suppressed on
              page-refresh rehydration (BE doesn't emit the progress
              event on rehydrate, only build_state). */}
          <BuildCompletionConfetti />
          {viewMode === "module" && mod ? (
            <ModuleSummary
              module={mod}
              moduleIndex={am}
              caseStudy={moduleCaseStudy}
              courseTitle={course.title}
              onUpdateModule={(fn: (m: Module) => void) => mutate((c) => { const m = c.modules[am]; if (m) fn(m); })}
              onJumpToLesson={(li: number) => { setAl(li); setViewMode("lesson"); }}
            />
          ) : lesson ? (
            <LessonCanvas
              lesson={lesson}
              module={course.modules[am]}
              course={course}
              brand={course.brand}
              am={am} al={al}
              onUpdateLesson={patchLesson}
              onUpdateBlock={patchBlock}
              onAddBlock={addBlock}
              onRemoveBlock={removeBlock}
              onMoveBlock={moveBlock}
              onDuplicateBlock={duplicateBlock}
              onEditBlock={setEditingBlockId}
              insertAt={insertAt}
              setInsertAt={setInsertAt}
              /* AI-1d: end-of-lesson Continue CTA navigation. Walks
                 to the next lesson, or — when on the last lesson of
                 the last module — loops back to lesson 1.1 with a
                 celebration framing. */
              onContinue={() => {
                const currentMod = course.modules[am];
                if (!currentMod) return;
                const isLastLessonInModule = al >= currentMod.lessons.length - 1;
                const isLastModule = am >= course.modules.length - 1;
                setEditingBlockId(null);
                if (!isLastLessonInModule) {
                  setAl(al + 1);
                } else if (!isLastModule) {
                  setAm(am + 1);
                  setAl(0);
                } else {
                  // Course completed — loop back to the first lesson.
                  setAm(0);
                  setAl(0);
                }
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <EmptyState icon={<BookOpen size={24} />} title="Pick a lesson" description="Select a lesson from the outline on the left to start building." />
            </div>
          )}
        </div>

        {/* Block editor slide-over */}
        {editingBlockId && lesson && (
          <BlockDrawer
            block={lesson.blocks.find((b) => b.id === editingBlockId)!}
            brand={course.brand}
            mod={course.modules[am]}
            lessonIndex={al}
            courseTitle={course.title}
            onUpdate={(fn) => patchBlock(editingBlockId, fn)}
            onClose={() => setEditingBlockId(null)}
            onDelete={() => removeBlock(editingBlockId)}
          />
        )}
      </div>

      {/* Floating Copilot */}
      <FloatingCopilot />

      {/* Preview modal */}
      {previewOpen && lesson && (
        <LessonPreviewModal lesson={lesson} course={course} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOP BAR
   ═══════════════════════════════════════════════════════════════════════════ */
function CourseTopBar({ course, lesson, onTitleChange, onBrandChange, onPreview, onExportScorm, onExportJson, onExportOutline, onExportCourseDocx, onClose, projectId }: any) {
  const [saved, setSaved] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => setSaved(true), 600);
    return () => clearTimeout(t);
  }, [course]);

  return (
    /* B3a: spacing + typography aligned with the global TopBar so
       the two bars read as one piece across pages. px-5 gap-4 +
       tracking-[-0.01em] on the title pull the chrome onto the
       same Sana-modern rhythm. */
    <header className="h-14 bg-white border-b border-ink-200 flex items-center px-5 gap-4 flex-shrink-0">
      <Link to="/" className="btn-ghost btn-sm -ml-2" title="Dashboard"><Home size={14} /></Link>
      <div className="h-5 w-px bg-ink-200" />
      <Link to="/courses" onClick={onClose} className="btn-ghost btn-sm">
        <ChevronLeft size={14} /> Courses
      </Link>

      <div className="flex-1 min-w-0 flex items-center gap-2 justify-center">
        <input
          value={course.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled course"
          className="max-w-md text-base font-bold text-ink-900 bg-transparent border-none outline-none text-center px-3 h-8 rounded tracking-[-0.01em] hover:bg-ink-50 focus:bg-white focus:shadow-focus transition-all duration-base ease-sana"
        />
        {lesson && (
          <>
            <span className="text-ink-300 text-sm">/</span>
            <span className="text-sm font-medium text-ink-500 truncate max-w-xs">{lesson.title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[11px] font-medium flex items-center gap-1.5 ${saved ? "text-ink-500" : "text-brand-700"}`}>
          {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Saving…</>}
        </span>

        {/* B3d: same swatch + tooltip treatment as the global TopBar's
            brand toggle, so both surfaces signal "active theme" the
            same way. The course-level toggle still writes to
            course.brand (per-project), and opening a course syncs
            the global active brand to it (existing behavior, line ~153). */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100"
          title="Theme used in preview & export"
        >
          {(Object.keys(B) as BrandKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onBrandChange(k)}
              className={`flex items-center gap-1.5 px-2 h-7 rounded text-[11px] font-semibold transition ${course.brand === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ background: B[k].pri }}
                aria-hidden="true"
              />
              {B[k].n}
            </button>
          ))}
        </div>

        <button onClick={onPreview} className="btn-secondary btn-sm" disabled={!lesson}><Eye size={14} /> Preview</button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)} className="btn-primary btn-sm"><Download size={14} /> Export</button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-40 bg-white rounded-lg border border-ink-200 shadow-elevated w-56 py-1">
              <button onClick={() => { setMenuOpen(false); onExportScorm(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2">
                <Download size={13} className="text-brand-600" />
                <div>
                  <div className="font-semibold text-ink-900">Lesson as SCORM (.zip)</div>
                  <div className="text-[10px] text-ink-400">Upload to NovoEd</div>
                </div>
              </button>
              <button onClick={() => { setMenuOpen(false); onExportJson(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2">
                <FileJson size={13} className="text-indigo-600" />
                <div>
                  <div className="font-semibold text-ink-900">Course as JSON</div>
                  <div className="text-[10px] text-ink-400">Back up or share with the team</div>
                </div>
              </button>
              <button onClick={() => { setMenuOpen(false); onExportOutline(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2">
                <FileText size={13} className="text-amber-600" />
                <div>
                  <div className="font-semibold text-ink-900">Outline as text</div>
                  <div className="text-[10px] text-ink-400">Summary of modules and lessons</div>
                </div>
              </button>
              <button onClick={() => { setMenuOpen(false); onExportCourseDocx(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2">
                <FileText size={13} className="text-brand-700" />
                <div>
                  <div className="font-semibold text-ink-900">Course as Word doc (.docx)</div>
                  <div className="text-[10px] text-ink-400">Full course — paste-ready for NovoEd / Rise</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEFT SIDEBAR — Outline / Materials tabs
   ═══════════════════════════════════════════════════════════════════════════ */
interface LeftSidebarProps {
  course: Course;
  am: number;
  al: number;
  viewMode: "lesson" | "module";
  leftPane: "outline" | "materials";
  setLeftPane: (v: "outline" | "materials") => void;
  onSelect: (mi: number, li: number) => void;
  onSelectModule: (mi: number) => void;
  onUpdate: (fn: (c: Course) => void) => void;
  onCollapse: () => void;
  onAddMaterial: (m: Material) => void;
  onRemoveMaterial: (id: string) => void;
}

function LeftSidebar({ course, am, al, viewMode, leftPane, setLeftPane, onSelect, onSelectModule, onUpdate, onCollapse, onAddMaterial, onRemoveMaterial }: LeftSidebarProps) {
  const matCount = course.materials?.length ?? 0;
  // sprint-2-5: outline-lock state. While the orchestrator is
  // actively building lessons the outline tree edits are paused —
  // the agent is concurrently mutating the course tree, and a
  // simultaneous LD edit would race. Navigation (click a lesson
  // row to view it) stays enabled so the LD can watch the build
  // unfold across the canvas.
  const { orchestratorState } = useAgent();
  const isBuilding = orchestratorState.phase === "building";
  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-ink-200 flex flex-col">
      <div className="h-11 flex items-center px-2 border-b border-ink-200 gap-1">
        <button
          onClick={() => setLeftPane("outline")}
          className={`flex-1 h-7 rounded-md text-[11px] font-bold uppercase tracking-wide transition ${
            leftPane === "outline" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800 hover:bg-ink-50"
          }`}
        >
          Outline
        </button>
        <button
          onClick={() => setLeftPane("materials")}
          className={`flex-1 h-7 rounded-md text-[11px] font-bold uppercase tracking-wide transition flex items-center justify-center gap-1.5 ${
            leftPane === "materials" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800 hover:bg-ink-50"
          }`}
        >
          Materials
          {matCount > 0 && (
            <span className="text-[10px] font-semibold opacity-70">{matCount}</span>
          )}
        </button>
        <button onClick={onCollapse} title="Collapse sidebar" className="text-ink-400 hover:text-ink-700 px-1.5 h-7 flex items-center">
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* sprint-2-5: edits-paused badge. Visible only during phase=
          "building"; explains why the add/delete/title controls
          below are disabled. Brand-tinted to match the build-progress
          band's visual language. Pulsing dot signals "active" state. */}
      {isBuilding && leftPane === "outline" && (
        <div className="outline-edits-paused-badge">
          <span className="outline-edits-paused-dot" aria-hidden="true" />
          <span>
            <strong>Building</strong> — edits paused
          </span>
        </div>
      )}

      {leftPane === "outline" ? (
        <CourseOutlineBody course={course} am={am} al={al} viewMode={viewMode} onSelect={onSelect} onSelectModule={onSelectModule} onUpdate={onUpdate} isBuilding={isBuilding} />
      ) : (
        <MaterialsShelf
          materials={course.materials ?? []}
          onAdd={onAddMaterial}
          onRemove={onRemoveMaterial}
        />
      )}
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OUTLINE BODY — modules & lessons list (rendered inside LeftSidebar)
   ═══════════════════════════════════════════════════════════════════════════ */
function CourseOutlineBody({ course, am, al, viewMode, onSelect, onSelectModule, onUpdate, isBuilding }: any) {
  // sprint-2-5: tiny helper that turns mutation calls into no-ops
  // during a build, with a one-line toast so the LD knows their
  // click registered but was deferred. Wrapped on every mutating
  // path below. Navigation (onSelect / onSelectModule) is NOT
  // wrapped — clicking a lesson row to view it stays live.
  function blockedDuringBuild(): boolean {
    if (!isBuilding) return false;
    toast("Edits paused while the course is building. Cancel or wait for completion.", false);
    return true;
  }

  function addModule() {
    if (blockedDuringBuild()) return;
    onUpdate((c: Course) => {
      const mi = c.modules.length + 1;
      c.modules.push({ id: rid(), title: "Module " + mi, lessons: [{ id: rid(), title: mi + ".1 New Lesson", duration: 5, blocks: [] }] });
    });
  }

  function addLesson(mi: number) {
    if (blockedDuringBuild()) return;
    onUpdate((c: Course) => {
      const m = c.modules[mi];
      if (!m) return;
      const li = m.lessons.length + 1;
      m.lessons.push({ id: rid(), title: (mi + 1) + "." + li + " New lesson", duration: 5, blocks: [] });
    });
  }

  function removeLesson(mi: number, li: number) {
    if (blockedDuringBuild()) return;
    onUpdate((c: Course) => {
      const m = c.modules[mi];
      if (!m || m.lessons.length <= 1) return;
      m.lessons.splice(li, 1);
    });
  }

  function removeModule(mi: number) {
    if (blockedDuringBuild()) return;
    onUpdate((c: Course) => {
      if (c.modules.length <= 1) return;
      c.modules.splice(mi, 1);
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        {course.modules.map((m: any, mi: number) => {
          const moduleActive = viewMode === "module" && am === mi;
          // sprint-2-2: precompute the absolute lesson index for the
          // first lesson in this module so the inner map can
          // calculate `moduleStartIdx + li` per row. The orchestrator
          // state's lessonStates dict is keyed by absolute index
          // across the whole course (locked, sprint-2-1).
          const moduleStartIdx = course.modules
            .slice(0, mi)
            .reduce((sum: number, prev: any) => sum + prev.lessons.length, 0);
          return (
          /* B3-tune-a + B3-tune-d: each module + its lessons wrapped
             in an outline-module-card. The module HEADER (badge +
             title row + meta row) is wrapped in a <button> click
             target so the LD doesn't have to hit the small 22px
             number badge to open module summary — the whole header
             strip works.

             Note on the structure: <input> + nested <button>s inside
             <button> is technically invalid HTML, but works fine in
             browsers and preserves the always-editable title UX
             without forcing click-to-edit. Inner interactives stop
             event propagation so they don't double-fire onSelectModule. */
          <div key={m.id} className={`outline-module-card${moduleActive ? " outline-module-card-active" : ""}`}>
            <button
              type="button"
              onClick={() => onSelectModule(mi)}
              title="Open module summary"
              className="outline-module-header-btn group"
            >
              <div className="outline-module-header">
                <span className="outline-module-num">{mi + 1}</span>
                <input
                  value={m.title}
                  onChange={(e) => {
                    if (isBuilding) return;
                    onUpdate((c: Course) => { c.modules[mi].title = e.target.value; });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  readOnly={isBuilding}
                  className="outline-module-title"
                />
                {course.modules.length > 1 && !isBuilding && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (confirm("Delete module '" + m.title + "'?")) removeModule(mi); }}
                    className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-opacity flex-shrink-0"
                    title="Delete module"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {/* B3-tune-d: chevron hint at the far right of the
                    header — fades in on hover to signal "this opens
                    module summary". 14px ink-400, sits after delete. */}
                <ChevronRight
                  size={14}
                  className="text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  aria-hidden="true"
                />
              </div>
              <div className="outline-module-meta">
                <span>{m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}</span>
                {m.caseStudyId && (() => {
                  const cs = course.caseStudies?.find((c: CaseStudy) => c.id === m.caseStudyId);
                  const designed = !!cs && (cs.context.trim().length > 0 || cs.stakeholders.length > 0);
                  const tip = cs
                    ? `Case study${designed ? "" : " (planted, not yet designed)"}: ${cs.title}`
                    : "Case study slot";
                  return (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelectModule(mi); }}
                      title={tip}
                      className="outline-cs-chip"
                    >
                      <BookOpen size={9} /> Case
                    </button>
                  );
                })()}
              </div>
            </button>
            <div className="outline-lessons">
              {m.lessons.map((l: any, li: number) => {
                const active = am === mi && al === li;
                return (
                  /* B3-tune-a: lesson row inside the module card.
                     Indented via .outline-lessons padding; active row
                     gets the 2px brand-500 left accent (.outline-lesson-
                     active::before) and brand-700 text + bg-brand-50. */
                  <div key={l.id} className={`outline-lesson-row group rounded-md flex items-center gap-1.5 px-2 py-1.5 cursor-pointer ${active ? "bg-brand-50 outline-lesson-active" : "hover:bg-ink-50"}`}
                    onClick={() => onSelect(mi, li)}
                  >
                    <span className={`text-[10px] font-bold flex-shrink-0 ${active ? "text-brand-700" : "text-ink-400"}`}>{mi + 1}.{li + 1}</span>
                    <span className={`text-[13px] flex-1 truncate ${active ? "text-brand-700 font-semibold" : "text-ink-700"}`}>
                      {l.title.replace(/^\d+\.\d+\s*/, "")}
                    </span>
                    {/* sprint-2-2: LessonTile overlays the block-count
                        chip with build state during orchestration.
                        Falls back to the legacy chip at idle. Read-only
                        in 2-2 — the row's onSelect still fires. */}
                    <LessonTile absoluteIndex={moduleStartIdx + li} blockCount={l.blocks.length} />
                    {m.lessons.length > 1 && !isBuilding && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("Delete lesson?")) removeLesson(mi, li); }}
                        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500 transition-opacity flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!isBuilding && (
              <button onClick={() => addLesson(mi)} className="outline-add-lesson">
                + lesson
              </button>
            )}
          </div>
          );
        })}
      </div>

      {!isBuilding && (
        <button onClick={addModule} className="mx-3 my-3 py-2 rounded-lg border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition flex items-center justify-center gap-1.5">
          <Plus size={12} /> Add module
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LESSON CANVAS
   ═══════════════════════════════════════════════════════════════════════════ */
function buildModuleKnowledgeCheckPrefill(
  mod: Module,
  mode: "write" | "regenerate",
): string {
  const week = mod.weekNumber ?? 1;
  if (mode === "regenerate") {
    return `Regenerate the final assessment for module ${week}: ${mod.title}. Same scope, fresh take.`;
  }
  return `Add the final assessment to module ${week}: ${mod.title}.\nModule id: ${mod.id}\n5 questions, all MCQ unless I say otherwise. Cover the module's objectives across Bloom's levels.`;
}

function buildModuleQuestionRegenPrefill(
  mod: Module,
  questionIndex: number,
): string {
  const week = mod.weekNumber ?? 1;
  return `Regenerate question ${questionIndex + 1} on the module ${week} final assessment. Same topic, fresh angle.`;
}

function buildCaseStudyDesignPrefill(
  caseStudy: CaseStudy,
  mode: "design" | "redesign",
): string {
  if (mode === "redesign") {
    return `Redesign the case study "${caseStudy.title}". Same title, fresh angle.`;
  }
  return `Design the case study "${caseStudy.title}".\nCase study id: ${caseStudy.id}\nFill in context, stakeholders, decision points, and debrief prompts.`;
}

function buildLessonKnowledgeCheckPrefill(
  mod: Module | undefined,
  lesson: Lesson,
  lessonIndex: number,
  mode: "write" | "regenerate",
): string {
  const week = mod?.weekNumber ?? 1;
  const lessonNum = lessonIndex + 1;
  const ref = `${week}.${lessonNum}`;
  if (mode === "regenerate") {
    return `Regenerate the knowledge check for lesson ${ref}. Same scope, fresh take.`;
  }
  return `Add a knowledge check to lesson ${ref}.\nLesson id: ${lesson.id}\n5 questions, all MCQ unless I say otherwise. Mix Bloom's levels across the set.`;
}

function buildRegenerateQuestionPrefill(
  mod: Module | undefined,
  lessonIndex: number,
  questionIndex: number,
): string {
  const week = mod?.weekNumber ?? 1;
  const lessonNum = lessonIndex + 1;
  const ref = `${week}.${lessonNum}`;
  return `Regenerate question ${questionIndex + 1} on lesson ${ref}. Same topic, fresh angle.`;
}

function buildLessonWriterPrefill(mod: Module | undefined, lesson: Lesson, lessonIndex: number, mode: "write" | "regenerate"): string {
  const week = mod?.weekNumber ?? 1;
  const lessonNum = lessonIndex + 1;
  const ref = `${week}.${lessonNum}`;
  const stripped = lesson.title.replace(new RegExp(`^${week}\\.${lessonNum}\\s*`), "");

  if (mode === "regenerate") {
    return `Regenerate lesson ${ref}: ${stripped}. Same scope, fresh take.`;
  }

  const objectives = lesson.objectives ?? [];
  const objectivesBlock = objectives.length
    ? `Objectives:\n${objectives.map((o) => `• ${o}`).join("\n")}\n`
    : "";

  return `Write lesson ${ref}: ${stripped}.\n${objectivesBlock}Target: ~${lesson.duration} min.\nFill this in.`;
}

interface ScriptWriterParams {
  duration: number;
  audience: string;
  tone: "conversational" | "authoritative" | "educational";
}

function buildVideoScriptPrefill(
  mod: Module | undefined,
  lessonIndex: number,
  blockId: string,
  videoType: "speaker" | "narration",
  mode: "write" | "regenerate",
  params?: ScriptWriterParams,
): string {
  const week = mod?.weekNumber ?? 1;
  const lessonNum = lessonIndex + 1;
  const ref = `${week}.${lessonNum}`;

  if (mode === "regenerate") {
    return `Regenerate the ${videoType} Synthesia script for video block ${blockId} on lesson ${ref}. Same scope, fresh take.`;
  }

  const duration = params?.duration ?? 90;
  const tone = params?.tone ?? "conversational";
  const audience = params?.audience?.trim();

  const lines = [
    `Write a ${videoType} Synthesia script for the video block on lesson ${ref}.`,
    `Video block id: ${blockId}`,
    `Target: ~${duration} sec.`,
    `Tone: ${tone}.`,
  ];
  if (audience) lines.push(`Audience: ${audience}.`);
  lines.push("Fill this in.");
  return lines.join("\n");
}

// Pull SPOKEN: blocks out of the script so the word count reflects only
// what the avatar will actually say. Skips SCENE markers, VISUAL: blocks,
// and any pause/voice tags inside the SPOKEN content.
function extractSpoken(s: string): string {
  const matches = s.matchAll(/SPOKEN:\s*([\s\S]*?)(?=\n\s*(?:VISUAL:|SCENE\s+\d+|$))/gi);
  let out = "";
  for (const m of matches) out += " " + m[1];
  return out.replace(/<[^>]*>/g, "").trim();
}

function wordCount(s: string): number {
  const spoken = extractSpoken(s);
  // Fallback for unstructured scripts (e.g. legacy [PAUSE] format or a
  // raw paragraph the LD pasted): strip bracket cues + tags, count rest.
  const fallback = spoken || s.replace(/\[[^\]]*\]/g, "").replace(/<[^>]*>/g, "").trim();
  if (!fallback) return 0;
  return fallback.split(/\s+/).length;
}

function estimateSeconds(s: string): number {
  return Math.round((wordCount(s) / 150) * 60);
}

interface Scene {
  index: number;
  spoken: string;
  visual: string;
}

// Parse a Synthesia script into scenes. Returns null if the text doesn't
// follow the SCENE / SPOKEN: / VISUAL: structure — caller falls back to
// the raw textarea so the LD is never locked out.
function parseScenes(script: string): Scene[] | null {
  if (!script || !script.trim()) return null;
  if (!/SCENE\s+\d+/i.test(script)) return null;
  if (!/(SPOKEN|VISUAL):/i.test(script)) return null;

  const lines = script.split(/\r?\n/);
  const scenes: Scene[] = [];
  let current: Scene | null = null;
  let field: "spoken" | "visual" | null = null;

  for (const line of lines) {
    const sceneMatch = /^\s*SCENE\s+(\d+)/i.exec(line);
    if (sceneMatch) {
      if (current) scenes.push(current);
      current = { index: parseInt(sceneMatch[1], 10), spoken: "", visual: "" };
      field = null;
      continue;
    }
    if (!current) continue;
    const spokenMatch = /^\s*SPOKEN:\s*(.*)$/i.exec(line);
    if (spokenMatch) { field = "spoken"; current.spoken = spokenMatch[1]; continue; }
    const visualMatch = /^\s*VISUAL:\s*(.*)$/i.exec(line);
    if (visualMatch) { field = "visual"; current.visual = visualMatch[1]; continue; }
    // Continuation line for the current section.
    if (field && line.trim()) {
      current[field] = (current[field] ? current[field] + "\n" : "") + line.trim();
    }
  }
  if (current) scenes.push(current);
  return scenes.length > 0 ? scenes : null;
}

function serializeScenes(scenes: Scene[]): string {
  return scenes.map((s) => `SCENE ${s.index}\nSPOKEN: ${s.spoken}\nVISUAL: ${s.visual}`).join("\n\n");
}

// Strip break tags (and any other XML-ish markup) from a SPOKEN line so
// the transcript view reads as clean copy.
function transcriptText(spoken: string): string {
  return spoken.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function ScriptTranscript({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="border border-ink-200 rounded-md bg-white px-3 py-3 max-h-[420px] overflow-y-auto">
      <div className="space-y-3">
        {scenes.map((s, i) => {
          const text = transcriptText(s.spoken);
          if (!text) return null;
          return (
            <p key={i} className="text-[12px] leading-relaxed text-ink-800">
              {text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

type ScriptView = "table" | "transcript" | "raw";

function ScriptEditor({
  script, videoType, onSave, onWrite, onRegenerate, onDownload,
}: {
  script: string | undefined;
  videoType: "speaker" | "narration";
  onSave: (next: string) => void;
  onWrite: (params?: ScriptWriterParams) => void;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  const [view, setView] = useState<ScriptView>("table");
  const [showWriteForm, setShowWriteForm] = useState(false);
  const scenes = useMemo(() => (script ? parseScenes(script) : null), [script]);

  // Empty state — CTA expands inline into a pre-flight form so the
  // LD can set duration / audience / tone before the agent runs.
  if (!script) {
    if (showWriteForm) {
      return (
        <ScriptWriterForm
          videoType={videoType}
          onSubmit={(params) => { setShowWriteForm(false); onWrite(params); }}
          onCancel={() => setShowWriteForm(false)}
        />
      );
    }
    return (
      <button
        onClick={() => setShowWriteForm(true)}
        className="w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-500 transition p-3 text-left flex items-start gap-2.5 group"
      >
        <div className="w-7 h-7 rounded-md bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-ink-900 group-hover:text-brand-700 mb-0.5">
            Write a {videoType} script
          </div>
          <div className="text-[11px] text-ink-600 leading-snug">
            Pick duration, audience, and tone first, then the agent drafts the scenes.
          </div>
        </div>
      </button>
    );
  }

  // If the script doesn't parse, only Raw view is meaningful — everything
  // else falls back to the underlying string with a small explanation.
  const effectiveView: ScriptView = scenes ? view : "raw";
  const counter = `~${wordCount(script)} words · ~${estimateSeconds(script)} sec at 150 wpm`;

  return (
    <>
      {scenes && (
        <div className="mb-2 flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
          {(["table", "transcript", "raw"] as const).map((v) => {
            const active = effectiveView === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 h-6 rounded text-[10px] font-semibold capitalize transition ${active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      {effectiveView === "table" && scenes ? (
        <SceneTable
          scenes={scenes}
          onSceneChange={(idx, fieldName, value) => {
            const next = scenes.map((s, i) => (i === idx ? { ...s, [fieldName]: value } : s));
            onSave(serializeScenes(next));
          }}
        />
      ) : effectiveView === "transcript" && scenes ? (
        <ScriptTranscript scenes={scenes} />
      ) : (
        <>
          {!scenes && (
            <div className="mb-1.5 text-[10px] text-ink-500 italic flex items-start gap-1">
              <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
              <span>Couldn't parse as scenes — showing raw text. Regenerate to restore the table view.</span>
            </div>
          )}
          <textarea
            value={script}
            onChange={(e) => onSave(e.target.value)}
            rows={10}
            className="w-full bg-white border border-ink-200 rounded-md px-2.5 py-2 text-[12px] font-mono leading-relaxed outline-none focus:border-brand-500 resize-y"
            placeholder="Synthesia script..."
          />
        </>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] text-ink-400">{counter}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-md border border-ink-200 text-[10px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
            title="Download this script as a Word document"
          >
            <Download size={10} /> Download .docx
          </button>
          <button
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-md border border-ink-200 text-[10px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
            title="Wipe this script and regenerate from scratch"
          >
            <Sparkles size={10} /> Regenerate
          </button>
        </div>
      </div>
    </>
  );
}

// Knowledge check renderer. Reads from lesson.knowledgeCheck (or
// module.knowledgeCheck — same shape). Empty: brand CTA. Filled:
// numbered question list with type tag, options/hints, correct
// answer highlight, rationale, per-question Regenerate.
function KnowledgeCheckSection({
  quiz, onWrite, onRegenerateAll, onRegenerateQuestion, scopeLabel = "lesson",
}: {
  quiz: Quiz | undefined;
  onWrite: () => void;
  onRegenerateAll: () => void;
  onRegenerateQuestion: (index: number) => void;
  scopeLabel?: "lesson" | "module";
}) {
  if (!quiz || quiz.questions.length === 0) {
    return (
      <button
        onClick={onWrite}
        className="w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-500 transition p-5 text-left flex items-start gap-3 group"
      >
        <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
          <ListChecks size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink-900 mb-0.5 group-hover:text-brand-700">
            Add {scopeLabel === "module" ? "the module final assessment" : "a knowledge check"}
          </div>
          <div className="text-xs text-ink-600 leading-snug">
            5 MCQs by default, mixing recall / apply / analyze across the set. You can ask the agent for short-answer in chat.
          </div>
        </div>
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white">
      <header className="flex items-center gap-2 px-5 h-12 border-b border-ink-100">
        <div className="w-6 h-6 rounded-md bg-brand-50 flex items-center justify-center text-brand-700">
          <ListChecks size={13} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">
            {scopeLabel === "module" ? "Module final assessment" : "Knowledge check"}
          </div>
          <div className="text-[10px] text-ink-500">
            {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={onRegenerateAll}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-ink-200 text-[11px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
          title="Regenerate the whole knowledge check"
        >
          <Sparkles size={12} /> Regenerate all
        </button>
      </header>

      <div className="divide-y divide-ink-100">
        {quiz.questions.map((q, i) => (
          <QuestionCard
            key={i}
            index={i}
            question={q}
            onRegenerate={() => onRegenerateQuestion(i)}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionCard({
  index, question, onRegenerate,
}: {
  index: number;
  question: QuizQuestion;
  onRegenerate: () => void;
}) {
  const typeLabel = question.type === "mcq" ? "MCQ" : "Short answer";
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3 mb-2">
        <span className="w-6 h-6 flex-shrink-0 rounded-md bg-ink-900 text-white text-[10px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
              {typeLabel}
            </span>
          </div>
          <div className="text-sm font-semibold text-ink-900 leading-snug whitespace-pre-wrap">
            {question.stem}
          </div>
        </div>
        <button
          onClick={onRegenerate}
          className="flex-shrink-0 inline-flex items-center gap-1 px-2 h-6 rounded-md border border-ink-200 text-[10px] font-semibold text-ink-500 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
          title="Regenerate this question"
        >
          <Sparkles size={10} /> Regenerate
        </button>
      </div>

      {question.type === "mcq" ? (
        <>
          <ol className="mt-2 space-y-1.5 ml-9">
            {question.options.map((opt, oi) => {
              const correct = oi === question.correctIndex;
              return (
                <li
                  key={oi}
                  className={`flex items-start gap-2 text-[13px] rounded-md px-2 py-1.5 ${correct ? "bg-brand-50 text-ink-900" : "text-ink-700"}`}
                >
                  <span className={`w-5 h-5 flex-shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center ${correct ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"}`}>
                    {correct ? <Check size={11} /> : String.fromCharCode(65 + oi)}
                  </span>
                  <span className="leading-snug whitespace-pre-wrap">{opt}</span>
                </li>
              );
            })}
          </ol>
          <div className="ml-9 mt-3 px-3 py-2 rounded-md bg-ink-50 border-l-2 border-brand-500">
            <div className="text-[9px] font-bold uppercase tracking-wide text-ink-500 mb-1">Rationale</div>
            <div className="text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap">
              {question.rationale}
            </div>
          </div>
        </>
      ) : (
        <div className="ml-9 mt-2 px-3 py-2 rounded-md bg-ink-50 border-l-2 border-brand-500">
          <div className="text-[9px] font-bold uppercase tracking-wide text-ink-500 mb-1">Expected answer hints (rubric for grading)</div>
          <ul className="text-[12px] text-ink-700 leading-relaxed list-disc pl-4 space-y-0.5">
            {question.expectedAnswerHints.map((h, hi) => (
              <li key={hi} className="whitespace-pre-wrap">{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ModuleSummary({
  module: mod, moduleIndex, caseStudy, courseTitle, onUpdateModule, onJumpToLesson,
}: {
  module: Module;
  moduleIndex: number;
  caseStudy: CaseStudy | undefined;
  courseTitle: string;
  onUpdateModule: (fn: (m: Module) => void) => void;
  onJumpToLesson: (li: number) => void;
}) {
  const { setOpen: setChatOpen, prefillInput } = useAgent();
  const week = mod.weekNumber ?? moduleIndex + 1;

  function triggerKnowledgeCheck(mode: "write" | "regenerate") {
    setChatOpen(true);
    prefillInput(buildModuleKnowledgeCheckPrefill(mod, mode));
  }
  function triggerModuleQuestionRegen(questionIndex: number) {
    setChatOpen(true);
    prefillInput(buildModuleQuestionRegenPrefill(mod, questionIndex));
  }
  function triggerCaseStudy(mode: "design" | "redesign") {
    if (!caseStudy) return;
    setChatOpen(true);
    prefillInput(buildCaseStudyDesignPrefill(caseStudy, mode));
  }

  async function downloadCaseStudyDocx() {
    if (!caseStudy) return;
    try {
      const res = await fetch(`${HTTP_URL}/export/case-study-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseStudy,
          courseName: courseTitle,
          moduleTitle: mod.title,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `server returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stem = `${courseTitle || "course"}-${mod.title || "module"}-case-study`.replace(/[^\w\-_.]/g, "_");
      a.download = `${stem}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Case study downloaded");
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Module header */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1">
          Week {week} · Module
        </div>
        <input
          value={mod.title}
          onChange={(e) => onUpdateModule((m) => { m.title = e.target.value; })}
          placeholder="Module title"
          className="w-full text-3xl font-bold text-ink-900 bg-transparent border-none outline-none mb-2 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus"
        />
        {mod.summary && (
          <textarea
            value={mod.summary}
            onChange={(e) => onUpdateModule((m) => { m.summary = e.target.value; })}
            rows={2}
            className="w-full text-sm text-ink-600 bg-transparent border-none outline-none resize-none mb-3 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus"
          />
        )}
        <div className="text-xs text-ink-500">
          {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Objectives */}
      {mod.objectives && mod.objectives.length > 0 && (
        <section className="mb-10">
          <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-2">Learning objectives</div>
          <ul className="space-y-1.5">
            {mod.objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-snug">{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lessons jump-list */}
      <section className="mb-10">
        <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-2">Lessons</div>
        <ol className="space-y-1">
          {mod.lessons.map((l, li) => (
            <li key={l.id}>
              <button
                onClick={() => onJumpToLesson(li)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md hover:bg-ink-50 transition group"
              >
                <span className="text-[10px] font-bold text-ink-400 group-hover:text-brand-700 flex-shrink-0">
                  {moduleIndex + 1}.{li + 1}
                </span>
                <span className="text-sm text-ink-800 flex-1 truncate">
                  {l.title.replace(/^\d+\.\d+\s*/, "")}
                </span>
                <span className="text-[10px] text-ink-400">
                  {l.duration} min · {l.blocks.length} block{l.blocks.length !== 1 ? "s" : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* Module final assessment */}
      <section className="mb-10">
        <KnowledgeCheckSection
          quiz={mod.knowledgeCheck}
          onWrite={() => triggerKnowledgeCheck("write")}
          onRegenerateAll={() => triggerKnowledgeCheck("regenerate")}
          onRegenerateQuestion={triggerModuleQuestionRegen}
          scopeLabel="module"
        />
      </section>

      {/* Case study slot */}
      {caseStudy && (
        <section>
          <CaseStudySection
            caseStudy={caseStudy}
            onDesign={() => triggerCaseStudy("design")}
            onRedesign={() => triggerCaseStudy("redesign")}
            onDownload={downloadCaseStudyDocx}
          />
        </section>
      )}
    </div>
  );
}

// Renders a planted case-study slot. Empty (no context, no
// stakeholders) → brand CTA. Filled → context paragraphs +
// stakeholder cards + decision points + debrief prompts.
function CaseStudySection({
  caseStudy, onDesign, onRedesign, onDownload,
}: {
  caseStudy: CaseStudy;
  onDesign: () => void;
  onRedesign: () => void;
  onDownload: () => void;
}) {
  const empty = !caseStudy.context.trim() && caseStudy.stakeholders.length === 0;

  if (empty) {
    return (
      <button
        onClick={onDesign}
        className="w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-500 transition p-5 text-left flex items-start gap-3 group"
      >
        <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-1">Case study slot</div>
          <div className="text-sm font-bold text-ink-900 mb-0.5 group-hover:text-brand-700">
            Design "{caseStudy.title}"
          </div>
          <div className="text-xs text-ink-600 leading-snug">
            Course Architect planted this slot. Click to ask the Case Study Designer to write the BCG-style scenario, stakeholder voices, decision points, and debrief prompts.
          </div>
        </div>
      </button>
    );
  }

  return (
    <article className="rounded-xl border border-ink-200 bg-white">
      <header className="flex items-center gap-2 px-5 h-12 border-b border-ink-100">
        <div className="w-6 h-6 rounded-md bg-brand-50 flex items-center justify-center text-brand-700">
          <BookOpen size={13} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider">Case study</div>
          <div className="text-[12px] font-semibold text-ink-900 truncate">{caseStudy.title}</div>
        </div>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-ink-200 text-[11px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
          title="Download as a Word document for facilitator handout"
        >
          <Download size={12} /> Download .docx
        </button>
        <button
          onClick={onRedesign}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-ink-200 text-[11px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
          title="Regenerate the case study"
        >
          <Sparkles size={12} /> Redesign
        </button>
      </header>

      <div className="p-5 space-y-6">
        {caseStudy.context.trim() && (
          <div>
            <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-2">Context</div>
            <div className="text-[13px] text-ink-800 leading-relaxed whitespace-pre-wrap">
              {caseStudy.context}
            </div>
          </div>
        )}

        {caseStudy.stakeholders.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-2">Stakeholders</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {caseStudy.stakeholders.map((s, i) => (
                <div key={i} className="rounded-lg border border-ink-200 bg-ink-50/40 p-3">
                  <div className="text-sm font-semibold text-ink-900">{s.name}</div>
                  <div className="text-[11px] text-ink-500 mb-2">{s.role}</div>
                  <div className="text-[12px] text-ink-700 italic leading-relaxed">"{s.voice}"</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {caseStudy.decisionPoints.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-2">Decision points</div>
            <ol className="space-y-1.5">
              {caseStudy.decisionPoints.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-ink-800">
                  <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {caseStudy.debriefPrompts.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-2">Debrief prompts <span className="text-ink-300 normal-case font-normal">(for LD facilitation)</span></div>
            <ul className="space-y-1.5">
              {caseStudy.debriefPrompts.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700">
                  <HelpCircle size={11} className="mt-1 text-ink-400 flex-shrink-0" />
                  <span className="leading-snug">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function ScriptWriterForm({
  videoType, onSubmit, onCancel,
}: {
  videoType: "speaker" | "narration";
  onSubmit: (params: ScriptWriterParams) => void;
  onCancel: () => void;
}) {
  const [duration, setDuration] = useState<number>(90);
  const [audience, setAudience] = useState<string>("");
  const [tone, setTone] = useState<ScriptWriterParams["tone"]>(videoType === "speaker" ? "conversational" : "educational");

  return (
    <div className="rounded-lg border border-brand-300 bg-brand-50/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} />
        </div>
        <div className="text-xs font-bold text-ink-900">Write a {videoType} script</div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide block mb-1">Duration</label>
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
          {[60, 90, 120, 180].map((d) => {
            const active = duration === d;
            return (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-2.5 h-6 rounded text-[10px] font-semibold transition ${active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
              >
                {d} sec
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide block mb-1">Audience <span className="text-ink-300 normal-case font-normal">(optional)</span></label>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. senior managers leading change"
          className="input"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide block mb-1">Tone</label>
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
          {(["conversational", "authoritative", "educational"] as const).map((t) => {
            const active = tone === t;
            return (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-2.5 h-6 rounded text-[10px] font-semibold capitalize transition ${active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
        <button onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
        <button onClick={() => onSubmit({ duration, audience, tone })} className="btn-primary btn-sm">
          <Sparkles size={12} /> Write
        </button>
      </div>
    </div>
  );
}

// Editor for a single scene cell. Keeps its own local state for the
// duration of one editing session — mounts when the user clicks the
// cell, unmounts when they blur. This avoids any cross-cell or
// cross-render state contamination.
//
// Focus is grabbed via ref + useEffect rather than autoFocus. autoFocus
// races with the browser's mousedown text-selection: the selection
// would steal focus a tick after autoFocus, causing onBlur → onCommit
// → unmount, which read as a green flicker. The mousedown handler on
// the non-editing cell already calls preventDefault to suppress the
// selection start, and useEffect runs after the textarea is mounted
// and the click event fully resolved.
function CellEditor({
  initial, monospace, color, onCommit,
}: {
  initial: string;
  monospace?: boolean;
  color?: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      rows={Math.max(2, value.split("\n").length)}
      className={`w-full text-[11px] ${monospace ? "font-mono" : ""} ${color ?? "text-ink-800"} bg-white border border-brand-500 rounded px-1.5 py-1 outline-none resize-none`}
    />
  );
}

function SceneTable({
  scenes, onSceneChange,
}: {
  scenes: Scene[];
  onSceneChange: (idx: number, field: "spoken" | "visual", value: string) => void;
}) {
  const [editing, setEditing] = useState<{ idx: number; field: "spoken" | "visual" } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function commitCell(idx: number, field: "spoken" | "visual", value: string) {
    if (value !== scenes[idx][field]) onSceneChange(idx, field, value);
    setEditing(null);
  }
  function copySpoken(idx: number) {
    const text = scenes[idx].spoken;
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1200);
    });
  }

  return (
    <div className="border border-ink-200 rounded-md overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_1fr_28px] bg-ink-50 text-ink-500 text-[9px] uppercase tracking-wide font-bold">
        <div className="px-1.5 py-1">#</div>
        <div className="px-1.5 py-1 border-l border-ink-100">Spoken</div>
        <div className="px-1.5 py-1 border-l border-ink-100">Visual</div>
        <div className="px-1 py-1 border-l border-ink-100"></div>
      </div>
      {scenes.map((s, idx) => {
        const isEditingSpoken = editing?.idx === idx && editing.field === "spoken";
        const isEditingVisual = editing?.idx === idx && editing.field === "visual";
        return (
          <div key={idx} className="grid grid-cols-[28px_1fr_1fr_28px] border-t border-ink-100">
            <div className="px-1.5 py-1.5 text-ink-400 font-bold text-[11px]">{s.index}</div>
            <div className="px-1 py-1 border-l border-ink-100">
              {isEditingSpoken ? (
                <CellEditor
                  initial={s.spoken}
                  monospace
                  color="text-ink-800"
                  onCommit={(v) => commitCell(idx, "spoken", v)}
                />
              ) : (
                <div
                  onMouseDown={(e) => { e.preventDefault(); setEditing({ idx, field: "spoken" }); }}
                  className="cursor-pointer whitespace-pre-wrap break-words text-[11px] font-mono text-ink-800 hover:bg-brand-50/40 rounded px-1.5 py-1 min-h-[28px]"
                >
                  {s.spoken || <span className="text-ink-300 italic">click to add</span>}
                </div>
              )}
            </div>
            <div className="px-1 py-1 border-l border-ink-100">
              {isEditingVisual ? (
                <CellEditor
                  initial={s.visual}
                  monospace
                  color="text-ink-600"
                  onCommit={(v) => commitCell(idx, "visual", v)}
                />
              ) : (
                <div
                  onMouseDown={(e) => { e.preventDefault(); setEditing({ idx, field: "visual" }); }}
                  className="cursor-pointer whitespace-pre-wrap break-words text-[11px] font-mono text-ink-600 hover:bg-brand-50/40 rounded px-1.5 py-1 min-h-[28px]"
                >
                  {s.visual || <span className="text-ink-300 italic">click to add</span>}
                </div>
              )}
            </div>
            <div className="px-0.5 py-1 border-l border-ink-100 flex items-start justify-center">
              <button
                onClick={() => copySpoken(idx)}
                disabled={!s.spoken}
                className="w-6 h-6 rounded text-ink-300 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
                title="Copy SPOKEN to clipboard"
              >
                {copiedIdx === idx ? <Check size={10} className="text-brand-600" /> : <Copy size={10} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LessonCanvas({ lesson, module: mod, course, brand, am, al, onUpdateLesson, onUpdateBlock, onAddBlock, onRemoveBlock, onMoveBlock, onDuplicateBlock, onEditBlock, insertAt, setInsertAt, onContinue }: any) {
  const { setOpen: setChatOpen, prefillInput, isThinking: agentThinking } = useAgent();
  const hasWriterBlocks = lesson.blocks.some((b: Block) => b.source === "writer");

  function triggerWriter(mode: "write" | "regenerate") {
    setChatOpen(true);
    prefillInput(buildLessonWriterPrefill(mod, lesson, al, mode));
  }

  function triggerKnowledgeCheck(mode: "write" | "regenerate") {
    setChatOpen(true);
    prefillInput(buildLessonKnowledgeCheckPrefill(mod, lesson, al, mode));
  }

  function triggerQuestionRegen(questionIndex: number) {
    setChatOpen(true);
    prefillInput(buildRegenerateQuestionPrefill(mod, al, questionIndex));
  }

  // AI-1d: lesson position + total for the "LESSON N OF M" hero subtitle.
  // Walks all modules to count global position; matches the NovoEd
  // / Rise screenshot framing where N is the absolute lesson index
  // across the whole course.
  const totalLessons = course?.modules
    ? course.modules.reduce((sum: number, m: Module) => sum + m.lessons.length, 0)
    : 1;
  const lessonAbsoluteIndex = course?.modules
    ? course.modules
        .slice(0, am)
        .reduce((sum: number, m: Module) => sum + m.lessons.length, 0) + al
    : 0;
  const lessonPositionLabel = `Lesson ${lessonAbsoluteIndex + 1} of ${totalLessons}`;
  const isLastLesson =
    course?.modules
      ? am === course.modules.length - 1 && al === course.modules[am].lessons.length - 1
      : false;

  // B3-tune-c: meta strings — icons render alongside in the JSX.
  // Module + dotted lesson reference still shown alongside "Lesson N of M".
  const lessonNumber = `${am + 1}.${al + 1}`;
  const moduleNumber = am + 1;
  const blockCountLabel = `${lesson.blocks.length} block${lesson.blocks.length !== 1 ? "s" : ""}`;
  void lessonNumber;
  void moduleNumber;

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* AI-1d: green-tinted hero band wrapping eyebrow + title + meta.
          Visually separates the lesson chrome from the body blocks
          below. Eyebrow flipped from "Module N · Lesson N.M" (B3-tune-c)
          to "LESSON N OF M" per the BCG U / Rise pattern. */}
      <div className="lesson-hero">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="lesson-eyebrow uppercase tracking-wider">
            {lessonPositionLabel}
          </div>
          {hasWriterBlocks && (
            <button
              onClick={() => triggerWriter("regenerate")}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-ink-200 text-[11px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition"
              title="Wipe AI-written blocks and regenerate"
            >
              <Sparkles size={12} /> Regenerate
            </button>
          )}
        </div>
        <input
          value={lesson.title}
          onChange={(e) => onUpdateLesson((l: Lesson) => { l.title = e.target.value; })}
          placeholder="Lesson title"
          className="lesson-title-input w-full bg-transparent border-none outline-none mb-2 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus transition-all duration-base ease-sana"
        />
        <div className="lesson-meta">
          <span className="lesson-meta-item">
            <Clock size={12} className="text-ink-400" />
            <input
              type="number"
              value={lesson.duration}
              min={1}
              onChange={(e) => onUpdateLesson((l: Lesson) => { l.duration = parseInt(e.target.value) || 5; })}
              className="w-10 bg-transparent border-none outline-none font-medium text-ink-700"
            />
            <span>min</span>
          </span>
          <span className="lesson-meta-item">
            <BarChart3 size={12} className="text-ink-400" />
            <span>{blockCountLabel}</span>
          </span>
          <span className="lesson-meta-item">
            <Check size={12} className="text-brand-600" />
            <span>Saved</span>
          </span>
        </div>
      </div>

      {/* polish-5c: in-flight loading card visible from the canvas
          surface during a write_lesson (or any agent turn). LD sees
          activity without having to glance at the chat panel. The
          AgentInflightIndicator returns null when not thinking, so
          this is a no-op at rest. */}
      {agentThinking && (
        <div className="agent-inflight-card-wrap mb-6">
          <AgentInflightIndicator centered />
        </div>
      )}

      {/* Blocks */}
      {lesson.blocks.length === 0 ? (
        <div className="py-6 space-y-6">
          {/* "Write this lesson" CTA — the AI-write entry point.
              Stays since it's a distinct action from inserting a
              single block; the new add-block hero (below) handles
              manual block insertion. */}
          <button
            onClick={() => triggerWriter("write")}
            className="w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-500 transition p-5 text-left flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink-900 mb-0.5 group-hover:text-brand-700">Write this lesson</div>
              <div className="text-xs text-ink-600">
                Have Studio Copilot draft a Hook → Body → Examples → Summary based on the title and objectives. You'll be able to edit the chat message before sending.
              </div>
            </div>
          </button>
          {/* B3-tune-c: designed Add-a-block hero CTA — the existing
              BlockInsertRow (in expanded form) renders the picker
              grid; this hero sits above as a more inviting entry
              point. Click anywhere on it to focus / scroll to the
              picker grid below.

              Existing keyboard / picker logic preserved by keeping
              <BlockInsertRow expanded />; this is a visual
              promotion only. */}
          <div
            className="add-block-hero"
            role="button"
            tabIndex={0}
            onClick={() => {
              const grid = document.getElementById("block-picker-grid");
              grid?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const grid = document.getElementById("block-picker-grid");
                grid?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }}
          >
            <div className="add-block-icon" aria-hidden="true">
              <Plus size={24} strokeWidth={2.5} />
            </div>
            <div className="add-block-title">
              Add a block — or ask Studio Copilot to write one
            </div>
            <div className="add-block-desc">
              Text, banner, callout, card grid, timeline, video script, quiz — 47 components.
            </div>
          </div>
          <div id="block-picker-grid">
            <BlockInsertRow onPick={(t) => onAddBlock(t)} expanded />
          </div>
        </div>
      ) : (
        <>
          <BlockInsertRow onPick={(t) => onAddBlock(t, 0)} compact />
          {lesson.blocks.map((blk: Block, i: number) => (
            <div key={blk.id}>
              <BlockCard
                block={blk}
                brand={brand}
                first={i === 0}
                last={i === lesson.blocks.length - 1}
                onInlineEdit={(field: string, val: unknown) => onUpdateBlock(blk.id, (b: Block) => { (b.data as Record<string, unknown>)[field] = val; })}
                onOpenEditor={() => onEditBlock(blk.id)}
                onMove={(d: -1 | 1) => onMoveBlock(blk.id, d)}
                onDuplicate={() => onDuplicateBlock(blk.id)}
                onRemove={() => onRemoveBlock(blk.id)}
              />
              <BlockInsertRow onPick={(t) => onAddBlock(t, i + 1)} compact />
            </div>
          ))}
        </>
      )}

      {/* AI-1d: knowledge check section in a tinted-green section wrapper.
          Visually demarcates the assessment block from lesson body —
          matches Screenshot 4 from the BCG U pattern set. Inner
          KnowledgeCheckSection unchanged. */}
      <div className="kc-section">
        <KnowledgeCheckSection
          quiz={lesson.knowledgeCheck}
          onWrite={() => triggerKnowledgeCheck("write")}
          onRegenerateAll={() => triggerKnowledgeCheck("regenerate")}
          onRegenerateQuestion={triggerQuestionRegen}
        />
      </div>

      {/* AI-1d: end-of-lesson Continue CTA. On the last lesson of the
          last module, the button copy flips to a celebration framing
          (🎉 You completed the course) and loops back to lesson 1.1
          when clicked. Otherwise advances to the next lesson. */}
      <button
        type="button"
        onClick={() => onContinue?.()}
        className="lesson-continue-cta"
      >
        {isLastLesson
          ? <>🎉 You completed the course — back to start <ArrowRight size={16} strokeWidth={2.5} /></>
          : <>Continue <ArrowRight size={16} strokeWidth={2.5} /></>}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK INSERT ROW — the "hover to insert" gap
   ═══════════════════════════════════════════════════════════════════════════ */
function BlockInsertRow({ onPick, compact = false, expanded = false }: { onPick: (type: string) => void; compact?: boolean; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);

  if (expanded || open) {
    return (
      <div className="my-4">
        <BlockPickerPanel onPick={(t) => { onPick(t); setOpen(false); }} onClose={() => setOpen(false)} expanded={expanded} />
      </div>
    );
  }

  return (
    <div className="group relative h-6 my-1 flex items-center justify-center">
      <div className="absolute inset-x-0 h-px bg-transparent group-hover:bg-brand-200 transition-colors" />
      <button
        onClick={() => setOpen(true)}
        className={`relative z-10 inline-flex items-center gap-1.5 px-3 h-6 rounded-full bg-white border border-ink-200 text-[11px] font-semibold text-ink-400 hover:text-brand-700 hover:border-brand-500 hover:bg-brand-50 transition ${compact ? "opacity-0 group-hover:opacity-100" : ""}`}
      >
        <Plus size={11} /> Add block
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK PICKER PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
function BlockPickerPanel({ onPick, onClose, expanded }: { onPick: (t: string) => void; onClose: () => void; expanded: boolean }) {
  // AI-1b: added quote, clickInstruction, sectionHeader to the picker.
  // Editorial group bundles the text-led blocks; Media is its own row
  // for image/video; Data + Assessment unchanged.
  const categories: { label: string; ids: string[] }[] = [
    { label: "Editorial",  ids: ["text", "banner", "callout", "quote", "sectionHeader", "clickInstruction", "divider"] },
    { label: "Media",      ids: ["image", "video"] },
    { label: "Data",       ids: ["cards", "stats", "timeline", "accordion", "flipcard"] },
    { label: "Assessment", ids: ["quiz", "poll"] },
  ];

  return (
    <div className="card p-5 relative">
      {!expanded && (
        <button onClick={onClose} className="absolute top-3 right-3 text-ink-400 hover:text-ink-700">
          <X size={14} />
        </button>
      )}
      <div className="text-xs font-bold text-ink-900 mb-4">Add a block</div>
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.label}>
            <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">{cat.label}</div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {cat.ids.map((id) => {
                const bt = BTYPES.find((x) => x.id === id);
                if (!bt) return null;
                return (
                  <button
                    key={id}
                    onClick={() => onPick(id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-ink-200 bg-white hover:border-brand-500 hover:bg-brand-50 transition group"
                  >
                    <div className="w-9 h-9 rounded-md flex items-center justify-center text-ink-500 bg-ink-100 group-hover:bg-white group-hover:text-brand-700 transition">
                      <BlockIcon type={id} size={16} />
                    </div>
                    <span className="text-[11px] font-semibold text-ink-700 group-hover:text-brand-700">{bt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK CARD — one block on the canvas
   ═══════════════════════════════════════════════════════════════════════════ */
function BlockCard({ block, brand, first, last, onInlineEdit, onOpenEditor, onMove, onDuplicate, onRemove }: any) {
  // AI-1b: new block types (quote, clickInstruction, sectionHeader)
  // edit inline like text/banner/callout/divider — single-shape data,
  // no items list to navigate.
  const isSimple = ["text", "banner", "callout", "quote", "clickInstruction", "sectionHeader", "divider"].includes(block.type);
  // polish-6c + polish-9b: accordion + flipcard get interactive
  // treatment on the canvas. Other complex blocks (cards / timeline
  // / quiz / poll / stats) still use the dangerouslySetInnerHTML
  // preview path until each gets its own interactive treatment.
  const isInteractiveAccordion = block.type === "accordion";
  const isInteractiveFlipcard = block.type === "flipcard";
  const bt = BTYPES.find((x) => x.id === block.type);
  const previewHtml = useMemo(() => previewBlock(block, brand), [block, brand]);

  return (
    <div className="group relative">
      {/* Side actions */}
      <div className="absolute -left-12 top-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onMove(-1)} disabled={first} className="w-8 h-7 rounded text-ink-400 hover:text-ink-800 hover:bg-white disabled:opacity-30 flex items-center justify-center"><ArrowUp size={12} /></button>
        <button onClick={() => onMove(1)} disabled={last} className="w-8 h-7 rounded text-ink-400 hover:text-ink-800 hover:bg-white disabled:opacity-30 flex items-center justify-center"><ArrowDown size={12} /></button>
      </div>

      <div className="rounded-xl bg-white border border-ink-200 hover:border-ink-300 hover:shadow-card transition group/block">
        {/* Block header */}
        <div className="flex items-center gap-2 px-4 h-9 border-b border-ink-100 bg-ink-50/50">
          <div className="w-5 h-5 rounded-md bg-white border border-ink-200 flex items-center justify-center text-ink-500 flex-shrink-0">
            <BlockIcon type={block.type} size={11} />
          </div>
          <span className="text-[11px] font-bold text-ink-700">{bt?.label || block.type}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
            {!isSimple && (
              <button onClick={onOpenEditor} title="Edit contents" className="w-7 h-7 rounded text-ink-400 hover:text-brand-700 hover:bg-white flex items-center justify-center">
                <Settings2 size={12} />
              </button>
            )}
            <button onClick={onDuplicate} title="Duplicate" className="w-7 h-7 rounded text-ink-400 hover:text-ink-800 hover:bg-white flex items-center justify-center">
              <Copy size={12} />
            </button>
            <button onClick={onRemove} title="Delete" className="w-7 h-7 rounded text-ink-400 hover:text-red-500 hover:bg-white flex items-center justify-center">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Body: inline edit for simple, rendered preview for complex */}
        <div className="p-5">
          {isSimple ? (
            <SimpleBlockEditor block={block} brand={brand} onChange={onInlineEdit} />
          ) : isInteractiveAccordion ? (
            /* polish-6c: clickable accordion. Title rows toggle the
               item open/closed; clicks on the body bubble up to the
               wrapper's onOpenEditor (so clicking outside a title row
               still opens the drawer for editing — same affordance as
               other complex blocks). */
            <div onClick={onOpenEditor} className="cursor-pointer">
              <InteractiveAccordion block={block} brand={brand} />
            </div>
          ) : isInteractiveFlipcard ? (
            /* polish-9b: clickable flipcards. Each card's click
               toggles its front/back state via 3D flip. Clicks on
               whitespace between cards bubble up to onOpenEditor —
               same drawer affordance as other complex blocks. */
            <div onClick={onOpenEditor} className="cursor-pointer">
              <InteractiveFlipcard block={block} brand={brand} />
            </div>
          ) : (
            <div onClick={onOpenEditor} className="cursor-pointer" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * polish-6c: interactive accordion preview for the lesson canvas.
 *
 * Pre-polish-6c the lesson canvas rendered accordions as static HTML
 * (previewBlock.ts case "accordion") — first item visually open, rest
 * closed, no click handlers. Live testing flagged this as a regression
 * the LD expected accordions to actually toggle in the canvas, since
 * the proposal card hint "click to expand" implies it.
 *
 * Visual matches previewBlock.ts case "accordion" exactly so the
 * non-interactive version (used in JSON exports / printable previews)
 * stays consistent. Only the canvas surface gets the interactive
 * treatment.
 *
 * Click-bubbling rules (locked spec): title-row click toggles open
 * state and stops the event so the parent's onOpenEditor doesn't
 * fire. Body click bubbles up — clicking the open body still opens
 * the drawer for editing. That gives the LD: title row to expand,
 * body / outside to edit.
 */
function InteractiveAccordion({ block, brand }: { block: Block; brand: BrandKey }) {
  const items = (block.data?.items || []) as { title?: string; desc?: string }[];
  const b = B[brand];
  // Keep the first item open by default to match the previous static
  // preview's first-item-open behavior — LDs are used to that frame.
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0]));

  function toggle(i: number, e: React.MouseEvent) {
    // Stop the event so the BlockCard's onOpenEditor doesn't also
    // fire (we want toggle-only on title-row clicks).
    e.stopPropagation();
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const visible = items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - 3);

  return (
    <div
      /* polish-9d: brand-color CSS variables exposed on the wrapper so
         the .accordion-item child rules (in index.css) can read them.
         Avoids per-item inline styles for hover / transition states
         that need pseudo-classes :hover can't see. */
      style={
        {
          "--acc-border": b.n2,
          "--acc-bg-rest": b.wh,
          "--acc-bg-open": b.priLt,
          "--acc-bg-hover": b.priLt,
          "--acc-fg": b.tx,
          "--acc-body-fg": b.txL,
        } as React.CSSProperties
      }
    >
      {visible.map((it, i) => {
        const isOpen = openSet.has(i);
        return (
          <div
            key={i}
            className={`accordion-item${isOpen ? " accordion-item-open" : ""}`}
          >
            <button
              type="button"
              onClick={(e) => toggle(i, e)}
              className="accordion-title"
              aria-expanded={isOpen}
            >
              <span>{it.title}</span>
              <span className="accordion-chevron" aria-hidden="true">
                ▼
              </span>
            </button>
            <div
              className="accordion-body"
              aria-hidden={!isOpen}
              dangerouslySetInnerHTML={{
                __html: renderInlineMd(it.desc || ""),
              }}
            />
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div
          style={{
            fontSize: 10,
            color: b.txL,
            textAlign: "center",
            paddingTop: 4,
          }}
        >
          +{hiddenCount} more section{hiddenCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

/**
 * polish-9b: interactive flipcard preview for the lesson canvas.
 *
 * Pre-polish-9b the canvas rendered flipcards via the same static
 * HTML preview as JSON exports — front face only, "Tap to flip"
 * label that didn't actually do anything. Live testing flagged this
 * as the same regression class as the static accordion.
 *
 * Front face: brand gradient + white title text + small "Tap to
 * flip" caption. Back face: white surface + dark body text. CSS
 * 3D flip via rotateY(180deg) on a transform-style:preserve-3d
 * inner container, with backface-visibility:hidden so only one
 * face shows at a time. 350ms transition feels snappy without
 * being jarring.
 *
 * Click bubbling: card click toggles + stops propagation; whitespace
 * between cards bubbles up to onOpenEditor for drawer editing
 * (same affordance as other complex blocks).
 */
function InteractiveFlipcard({ block, brand }: { block: Block; brand: BrandKey }) {
  const items = (block.data?.items || []) as { title?: string; desc?: string }[];
  const b = B[brand];
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  function toggle(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const visible = items.slice(0, 6);

  return (
    /* polish-9b-overflow: grid layout (was flex-wrap) so all cards
       in a row stretch to equal height. grid-auto-rows defaults to
       auto, so each row sizes to its tallest card; the sizer trick
       (hidden div with the longer content) gives that "tallest"
       its intrinsic height even though front + back faces are
       absolutely positioned. */
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      {visible.map((it, i) => {
        const isFlipped = flipped.has(i);
        // Pick whichever is longer for the sizer so the cell grows
        // to fit the worst-case content. Both faces fill the cell.
        const sizerContent =
          (it.desc || "").length > (it.title || "").length ? it.desc : it.title;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => toggle(i, e)}
            style={{
              minHeight: 110,
              perspective: 1000,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            aria-label={
              isFlipped
                ? `${it.title || "card"} — back, click to flip`
                : `${it.title || "card"} — front, click to flip`
            }
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 110,
                transformStyle: "preserve-3d",
                transition: "transform 350ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Hidden sizer — determines the intrinsic height of
                  this cell so absolute-positioned faces have something
                  to fill. Picks the longer content so neither face
                  overflows. */}
              <div
                aria-hidden="true"
                style={{
                  visibility: "hidden",
                  padding: 12,
                  fontSize: 11,
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                {sizerContent || ""}
              </div>
              {/* Front face — brand gradient + title */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: b.grad,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  padding: 12,
                  gap: 6,
                  WebkitBackfaceVisibility: "hidden",
                  backfaceVisibility: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {it.title}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Tap to flip
                </div>
              </div>
              {/* Back face — white surface + body */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: b.wh,
                  borderRadius: 10,
                  border: `1px solid ${b.n2}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  WebkitBackfaceVisibility: "hidden",
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: b.tx,
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  {it.desc || ""}
                </div>
              </div>
            </div>
          </button>
        );
      })}
      {items.length > visible.length && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: 10,
            color: b.txL,
            textAlign: "center",
            paddingTop: 4,
          }}
        >
          +{items.length - visible.length} more card
          {items.length - visible.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMPLE BLOCK INLINE EDITORS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * SECTION_ICON_COMPONENTS — name -> lucide icon component map for the
 * sectionHeader block (AI-1b). The 12 names come from
 * SECTION_ICON_NAMES in app/src/course/blockTypes.ts. The agent's
 * prompt (AI-1c) references these names exactly so it can't reach for
 * an icon outside the curated set; unknown names fall back to BookOpen.
 *
 * Lives in CourseStudio.tsx because that's where SimpleBlockEditor and
 * the LessonCanvas section-header rendering both consume it. If a
 * second surface needs section icons, lift to course/sectionIcons.tsx.
 */
const SECTION_ICON_COMPONENTS: Record<string, LucideIcon> = {
  target:      Target,
  brain:       Brain,
  pencil:      Pencil,
  quote:       Quote,
  check:       CheckCircle2,
  clock:       Clock,
  lightbulb:   Lightbulb,
  bookOpen:    BookOpen,
  sparkles:    Sparkles,
  alertCircle: AlertCircle,
  trendingUp:  TrendingUp,
  users:       Users,
};

function SimpleBlockEditor({ block, brand, onChange }: { block: Block; brand: BrandKey; onChange: (field: string, val: any) => void }) {
  const b = B[brand];
  const d = block.data || {};

  if (block.type === "text") {
    // AI-1-polish-B bug 5/6: focus-toggle editor — when blurred, show
    // the rendered preview (markdown bold + numbered-line markers);
    // when focused, swap back to the plain textarea so the LD edits
    // raw asterisks. Q2 from the AI-1 spec was "simple textarea-as-
    // asterisks" — but live testing showed the rendered output never
    // surfaced in the canvas, only in the preview modal / .docx
    // export. Focus-toggle preserves the simple-edit UX while making
    // the canvas show what the LD will actually publish.
    return (
      <TextBlockEditor
        content={d.content || ""}
        onChange={(val) => onChange("content", val)}
      />
    );
  }

  if (block.type === "banner") {
    // AI-1b: banner gains an optional imageUrl. When set, the banner
    // renders as a "statement" with the photo as background + brand-
    // gradient as a tinted overlay; when unset, gradient-only (legacy).
    // Per Q1 confirm: extend banner rather than build a separate
    // Statement block type.
    const bannerStyle = d.imageUrl
      ? {
          backgroundImage: `linear-gradient(135deg, ${b.priDk}cc, ${b.pri}99), url("${d.imageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: b.grad };
    return (
      <div className="rounded-lg overflow-hidden" style={bannerStyle}>
        <div className="p-6 min-h-[140px]">
          <input
            value={d.title || ""}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="Banner title"
            className="w-full text-lg font-bold text-white bg-transparent border-none outline-none placeholder:text-white/50 mb-2"
          />
          <textarea
            value={d.body || ""}
            onChange={(e) => onChange("body", e.target.value)}
            rows={2}
            placeholder="Supporting message"
            className="w-full text-sm text-white/90 bg-transparent border-none outline-none resize-none placeholder:text-white/40 mb-3"
          />
          {/* Photo URL input — small caption-sized strip at the bottom.
              Paste an Unsplash URL for the statement-style background. */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/15">
            <ImageIcon size={12} className="text-white/60 flex-shrink-0" />
            <input
              value={d.imageUrl || ""}
              onChange={(e) => onChange("imageUrl", e.target.value)}
              placeholder="Optional photo URL (Unsplash, etc.)"
              className="flex-1 min-w-0 text-[11px] text-white/80 bg-transparent border-none outline-none placeholder:text-white/40"
            />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "quote") {
    // AI-1b: pull quote with attribution. Body in italic ink-900 on a
    // brand-50 wash with a brand-500 left accent bar. Optional round
    // photo + name + role for the attribution row.
    return (
      <div className="rounded-r-lg border-l-[3px] flex gap-3.5 p-4" style={{ borderLeftColor: b.pri, background: b.priLt }}>
        {d.attributionPhotoUrl && (
          <img
            src={d.attributionPhotoUrl}
            alt={d.attribution || ""}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <textarea
            value={d.body || ""}
            onChange={(e) => onChange("body", e.target.value)}
            rows={2}
            placeholder="The quote itself."
            className="w-full text-[15px] italic text-ink-900 bg-transparent border-none outline-none resize-none placeholder:text-ink-400 leading-relaxed"
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <input
              value={d.attribution || ""}
              onChange={(e) => onChange("attribution", e.target.value)}
              placeholder="Speaker name"
              className="text-xs font-bold text-ink-900 bg-transparent border-none outline-none placeholder:text-ink-400 min-w-0 flex-shrink"
              style={{ width: `${Math.max((d.attribution?.length || 12), 12)}ch` }}
            />
            <input
              value={d.attributionRole || ""}
              onChange={(e) => onChange("attributionRole", e.target.value)}
              placeholder="Role, Company"
              className="text-xs text-ink-500 bg-transparent border-none outline-none placeholder:text-ink-400 min-w-0 flex-1"
            />
          </div>
          <input
            value={d.attributionPhotoUrl || ""}
            onChange={(e) => onChange("attributionPhotoUrl", e.target.value)}
            placeholder="Optional photo URL"
            className="w-full text-[10px] text-ink-400 bg-transparent border-none outline-none placeholder:text-ink-300"
          />
        </div>
      </div>
    );
  }

  if (block.type === "clickInstruction") {
    // AI-1b: italic green hint, sized for placement directly above
    // an interactive. Inline editor mirrors the rendered look.
    return (
      <div className="flex items-center gap-2 py-1">
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[9px] font-bold flex-shrink-0"
          style={{ background: b.pri }}
        >
          →
        </span>
        <input
          value={d.content || ""}
          onChange={(e) => onChange("content", e.target.value)}
          placeholder="Click each card to reveal the answer."
          className="flex-1 italic text-xs bg-transparent border-none outline-none placeholder:text-ink-300"
          style={{ color: b.priDk }}
        />
      </div>
    );
  }

  if (block.type === "sectionHeader") {
    // AI-1b: icon-circle + title + accent rule. Icon picker uses the
    // 12 curated names (SECTION_ICON_NAMES from blockTypes.ts).
    const IconCmp = SECTION_ICON_COMPONENTS[d.iconName || "bookOpen"] ?? BookOpen;
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: b.priLt, color: b.pri }}
        >
          <IconCmp size={15} />
        </div>
        <input
          value={d.title || ""}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Section title"
          className="text-sm font-bold text-ink-900 bg-transparent border-none outline-none placeholder:text-ink-400"
          style={{ width: `${Math.max((d.title?.length || 14), 14)}ch` }}
        />
        <select
          value={d.iconName || "bookOpen"}
          onChange={(e) => onChange("iconName", e.target.value)}
          className="text-[10px] text-ink-500 bg-white border border-ink-200 rounded px-1.5 h-6 outline-none focus:border-brand-500"
          title="Section icon"
        >
          {Object.keys(SECTION_ICON_COMPONENTS).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="flex-1 h-px" style={{ background: b.n2 }} />
      </div>
    );
  }

  if (block.type === "callout") {
    const types = [{ v: "info", l: "Info", emoji: "ℹ️" }, { v: "tip", l: "Tip", emoji: "💡" }, { v: "warning", l: "Warning", emoji: "⚠️" }, { v: "success", l: "Success", emoji: "✅" }];
    const current = types.find((t) => t.v === (d.type || "tip")) || types[1];
    const isWarn = d.type === "warning";
    return (
      <div className={`rounded-r-lg border-l-4 ${isWarn ? "border-amber-500 bg-amber-50" : "border-brand-500 bg-brand-50"} p-4`}>
        <div className="flex items-start gap-3">
          <span className="text-xl">{current.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex gap-1 mb-2">
              {types.map((t) => (
                <button
                  key={t.v}
                  onClick={() => onChange("type", t.v)}
                  className={`text-[10px] px-2 h-5 rounded-md font-semibold transition ${d.type === t.v ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            {/* polish-6b: focus-toggle for callout body. Same pattern
                as TextBlockEditor — blurred state shows the rendered
                markdown (so **bold** displays bold instead of literal
                asterisks); click to swap to a plain textarea for
                editing. */}
            <CalloutBodyEditor
              body={d.body || ""}
              onChange={(val) => onChange("body", val)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="flex-1 h-0.5" style={{ background: b.pri }} />
        <input
          value={d.title || ""}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Section label (optional)"
          className="text-xs font-bold uppercase tracking-widest text-center bg-transparent border-none outline-none placeholder:text-ink-300"
          style={{ color: b.pri, minWidth: d.title ? 0 : 140, width: (d.title?.length || 14) + "ch" }}
        />
        <div className="flex-1 h-0.5" style={{ background: b.pri }} />
      </div>
    );
  }

  return null;
}

/**
 * TextBlockEditor — focus-toggle editor for text blocks (AI-1-polish-B).
 *
 * When unfocused, renders the markdown-rendered preview (inline bold +
 * numbered-line markers via renderTextBlockBody). Click to swap to a
 * plain textarea for editing; blur to swap back.
 *
 * Pre-polish-B the canvas always showed a textarea, so live LDs saw
 * `**bold phrases**` with literal asterisks AND no numbered-line
 * styling. Preview modal + .docx export rendered correctly, but the
 * canvas didn't — Lesson Writer v2 output looked broken in the spot
 * where LDs do most of their reviewing.
 *
 * Focus-toggle preserves the simple-edit UX (LD types raw markdown
 * in the textarea) while making the canvas show the publishable form
 * by default.
 */
function TextBlockEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={Math.max(3, content.split("\n").length)}
        placeholder="Start writing..."
        autoFocus
        className="w-full text-[15px] leading-relaxed text-ink-900 bg-transparent border-none outline-none resize-none placeholder:text-ink-300"
      />
    );
  }

  if (!content) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="text-[15px] leading-relaxed text-ink-300 cursor-text"
      >
        Click to start writing…
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-[15px] leading-relaxed text-ink-900 cursor-text text-block-render"
      dangerouslySetInnerHTML={{ __html: renderTextBlockBody(content) }}
    />
  );
}

/**
 * polish-6b: callout body editor — same focus-toggle pattern as
 * TextBlockEditor. Blurred state shows the rendered body (so
 * **bold** displays as actual bold), focused state swaps to a plain
 * textarea so the LD types raw markdown. Pre-polish-6b the body
 * always rendered as a textarea, so callout bodies showed literal
 * asterisks on the canvas.
 *
 * Lives outside SimpleBlockEditor so the editing state survives
 * SimpleBlockEditor re-renders (e.g. when the LD toggles the
 * Info/Tip/Warning/Success type chip — that mutates props but
 * shouldn't kick the LD out of the textarea mid-edit).
 */
function CalloutBodyEditor({
  body,
  onChange,
}: {
  body: string;
  onChange: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={Math.max(2, body.split("\n").length)}
        placeholder="Your message..."
        autoFocus
        className="w-full text-sm text-ink-800 bg-transparent border-none outline-none resize-none placeholder:text-ink-400"
      />
    );
  }

  if (!body) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="text-sm text-ink-400 cursor-text"
      >
        Your message…
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-sm text-ink-800 cursor-text"
      dangerouslySetInnerHTML={{ __html: renderInlineMd(body) }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCK DRAWER — slide-over editor for complex blocks
   ═══════════════════════════════════════════════════════════════════════════ */
const HTTP_URL = (import.meta.env.VITE_AGENT_HTTP_URL as string | undefined) ?? "http://127.0.0.1:8766";

function BlockDrawer({ block, brand, mod, lessonIndex, courseTitle, onUpdate, onClose, onDelete }: { block: Block; brand: BrandKey; mod: Module | undefined; lessonIndex: number; courseTitle: string; onUpdate: (fn: (b: Block) => void) => void; onClose: () => void; onDelete: () => void }) {
  const bt = BTYPES.find((x) => x.id === block.type);
  const d = block.data || {};
  const items = d.items || [];
  const { setOpen: setChatOpen, prefillInput } = useAgent();

  function patchField(field: string, val: any) { onUpdate((b) => { (b.data as any)[field] = val; }); }
  function patchItem(i: number, field: string, val: any) { onUpdate((b) => { if (b.data.items && b.data.items[i]) (b.data.items[i] as any)[field] = val; }); }
  function addItem() { onUpdate((b) => { if (b.data.items) b.data.items.push(newItem(block.type)); }); }
  function rmItem(i: number) {
    const minItems = block.type === "quiz" ? 2 : 1;
    if ((items.length) <= minItems) { toast("Need at least " + minItems + " item(s)", false); return; }
    onUpdate((b) => { if (b.data.items) b.data.items.splice(i, 1); });
  }

  function triggerScriptWriter(mode: "write" | "regenerate", params?: ScriptWriterParams) {
    const videoType = (d.videoType ?? "speaker") as "speaker" | "narration";
    setChatOpen(true);
    prefillInput(buildVideoScriptPrefill(mod, lessonIndex, block.id, videoType, mode, params));
  }

  async function downloadScriptDocx() {
    if (!d.script) return;
    const week = mod?.weekNumber ?? 1;
    const lessonRef = `${week}.${lessonIndex + 1}`;
    const videoType = (d.videoType ?? "speaker") as "speaker" | "narration";
    const seconds = estimateSeconds(d.script);
    const duration = seconds > 0 ? `~${seconds} sec` : "";
    try {
      const res = await fetch(`${HTTP_URL}/export/script-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: d.script,
          videoType,
          lessonRef,
          courseName: courseTitle,
          duration,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `server returned ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stem = `${courseTitle || "script"}-${lessonRef}-script`.replace(/[^\w\-_.]/g, "_");
      a.download = `${stem}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Script downloaded");
    } catch (e) {
      toast(`Download failed: ${(e as Error).message}`, false);
    }
  }

  // Width modes: narrow drawer (default), wide drawer for long content,
  // and full-screen overlay for deep editing. Cycles narrow → wide → full
  // → narrow on each click of the toggle button.
  const [drawerSize, setDrawerSize] = useState<"narrow" | "wide" | "full">("narrow");
  const NEXT_SIZE: Record<typeof drawerSize, typeof drawerSize> = { narrow: "wide", wide: "full", full: "narrow" };
  const SIZE_TITLE: Record<typeof drawerSize, string> = {
    narrow: "Expand to wide view",
    wide: "Expand to full screen",
    full: "Collapse to narrow",
  };
  const SizeIcon = drawerSize === "full" ? Minimize2 : Maximize2;
  const isFullscreen = drawerSize === "full";

  const asideClass = isFullscreen
    ? "fixed inset-0 z-40 bg-white flex flex-col"
    : drawerSize === "wide"
    ? "w-[720px] flex-shrink-0 bg-white border-l border-ink-200 flex flex-col"
    : "w-[380px] flex-shrink-0 bg-white border-l border-ink-200 flex flex-col";

  return (
    <aside className={asideClass}>
      <div className="h-11 border-b border-ink-200 px-4 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-ink-100 flex items-center justify-center text-ink-600">
          <BlockIcon type={block.type} size={12} />
        </div>
        <span className="text-sm font-semibold text-ink-900">{bt?.label}</span>
        <span className="text-[10px] text-ink-400 ml-auto">Block settings</span>
        <button
          onClick={() => setDrawerSize(NEXT_SIZE[drawerSize])}
          className="text-ink-400 hover:text-ink-700 ml-1 w-6 h-6 flex items-center justify-center rounded hover:bg-ink-100"
          title={SIZE_TITLE[drawerSize]}
        >
          <SizeIcon size={13} />
        </button>
        <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
      </div>

      <div className={`flex-1 overflow-y-auto ${isFullscreen ? "px-8 py-6" : "p-4"}`}>
        <div className={`space-y-4 ${isFullscreen ? "max-w-3xl mx-auto" : ""}`}>
        {/* Title / body shared fields */}
        {d.title !== undefined && (
          <Field label="Title">
            <input value={d.title} onChange={(e) => patchField("title", e.target.value)} className="input" />
          </Field>
        )}
        {d.body !== undefined && (
          <Field label="Body / description">
            <textarea value={d.body} onChange={(e) => patchField("body", e.target.value)} rows={3} className="textarea" />
          </Field>
        )}

        {/* Image URL for image */}
        {block.type === "image" && (
          <>
            <Field label="Image URL">
              <input value={d.url || ""} onChange={(e) => patchField("url", e.target.value)} placeholder="https://..." className="input" />
            </Field>
            <Field label="Caption">
              <input value={d.caption || ""} onChange={(e) => patchField("caption", e.target.value)} className="input" />
            </Field>
          </>
        )}

        {block.type === "video" && (
          <>
            <Field label="Video URL (YouTube / Vimeo)">
              <input value={d.url || ""} onChange={(e) => patchField("url", e.target.value)} placeholder="https://..." className="input" />
            </Field>
            <Field label="Caption">
              <input value={d.caption || ""} onChange={(e) => patchField("caption", e.target.value)} className="input" />
            </Field>
            <Field label="Video type">
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
                {(["speaker", "narration"] as const).map((vt) => {
                  const active = (d.videoType ?? "speaker") === vt;
                  return (
                    <button
                      key={vt}
                      onClick={() => patchField("videoType", vt)}
                      className={`px-3 h-6 rounded text-[11px] font-semibold capitalize transition ${active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
                    >
                      {vt}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[10px] text-ink-400 leading-snug">
                {(d.videoType ?? "speaker") === "speaker"
                  ? "Avatar talks to camera. Sparse visuals — lower-thirds, supporting graphics."
                  : "Voice-over narration. Rich visuals — full-screen footage, animations, b-roll."}
              </div>
            </Field>
            <Field label="Synthesia avatar script">
              <ScriptEditor
                script={d.script}
                videoType={(d.videoType ?? "speaker") as "speaker" | "narration"}
                onSave={(s) => patchField("script", s)}
                onWrite={(params) => triggerScriptWriter("write", params)}
                onRegenerate={() => triggerScriptWriter("regenerate")}
                onDownload={downloadScriptDocx}
              />
            </Field>
          </>
        )}

        {/* Items */}
        {d.items && (
          <>
            <Field label={block.type === "quiz" ? "Options" : block.type === "poll" ? "Options (with % result)" : "Items"}>
              <div className="space-y-2">
                {block.type === "quiz" && (
                  <div className="rounded-lg bg-ink-50 border border-ink-100 p-2.5">
                    <label className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-1 block">Question</label>
                    <textarea
                      value={items[0]?.title || ""}
                      onChange={(e) => patchItem(0, "title", e.target.value)}
                      rows={2}
                      className="textarea text-sm"
                      placeholder="Type your question..."
                    />
                  </div>
                )}
                {(block.type === "quiz" ? items.slice(1) : items).map((it: BlockItem, i: number) => {
                  const realIdx = block.type === "quiz" ? i + 1 : i;
                  const isCorrect = block.type === "quiz" && it.desc === "1";
                  return (
                    <div key={realIdx} className="rounded-lg bg-ink-50 border border-ink-100 p-2.5 relative group">
                      <div className="flex items-start gap-2">
                        {block.type === "quiz" ? (
                          <button
                            onClick={() => patchItem(realIdx, "desc", isCorrect ? "0" : "1")}
                            className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center text-xs mt-0.5 ${isCorrect ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-400"}`}
                            title={isCorrect ? "Correct answer" : "Mark correct"}
                          >
                            {isCorrect ? "✓" : ""}
                          </button>
                        ) : (
                          <span className="w-6 h-6 flex-shrink-0 rounded-md bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <input
                            value={it.title || ""}
                            onChange={(e) => patchItem(realIdx, "title", e.target.value)}
                            placeholder={block.type === "quiz" ? "Option text" : "Title"}
                            className="w-full bg-white border border-ink-200 rounded-md px-2 h-7 text-xs font-semibold outline-none focus:border-brand-500 mb-1.5"
                          />
                          {it.desc !== undefined && block.type !== "quiz" && block.type !== "poll" && (
                            <textarea
                              value={it.desc}
                              onChange={(e) => patchItem(realIdx, "desc", e.target.value)}
                              rows={2}
                              placeholder={block.type === "flipcard" ? "Back content" : "Description"}
                              className="w-full bg-white border border-ink-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-brand-500 resize-none"
                            />
                          )}
                          {block.type === "poll" && (
                            <input
                              value={it.desc || "25"}
                              onChange={(e) => patchItem(realIdx, "desc", e.target.value)}
                              placeholder="25"
                              className="w-full bg-white border border-ink-200 rounded-md px-2 h-7 text-xs outline-none focus:border-brand-500"
                            />
                          )}
                          {block.type === "flipcard" && it.img !== undefined && (
                            <input
                              value={it.img || ""}
                              onChange={(e) => patchItem(realIdx, "img", e.target.value)}
                              placeholder="Image URL (optional)"
                              className="w-full bg-white border border-ink-200 rounded-md px-2 h-7 text-xs outline-none focus:border-brand-500 mt-1.5"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => rmItem(realIdx)}
                          className="w-6 h-6 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0"
                          title="Remove"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={addItem} className="w-full h-8 rounded-lg border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition flex items-center justify-center gap-1.5">
                  <Plus size={12} /> Add {block.type === "quiz" ? "option" : block.type === "poll" ? "option" : block.type === "flipcard" ? "card" : "item"}
                </button>
              </div>
            </Field>
          </>
        )}
        </div>
      </div>

      <div className={`border-t border-ink-200 ${isFullscreen ? "p-4" : "p-3"}`}>
        <div className={isFullscreen ? "max-w-3xl mx-auto" : ""}>
          <button onClick={() => { if (confirm("Delete this block?")) onDelete(); }} className="btn-danger btn-sm w-full">
            <Trash2 size={13} /> Remove block
          </button>
        </div>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LESSON PREVIEW (full-screen modal)
   ═══════════════════════════════════════════════════════════════════════════ */
function LessonPreviewModal({ lesson, course, onClose }: { lesson: Lesson; course: Course; onClose: () => void }) {
  const src = useMemo(() => {
    // Stitch lesson preview HTML (reuse course preview)
    const b = B[course.brand];
    const inner = lesson.blocks.map((blk) => {
      return '<div style="margin-bottom:28px;">' + previewBlock(blk, course.brand) + "</div>";
    }).join("");
    // polish-6d-preview: inject numbered-line + text-line CSS so
    // takeaway lists from renderTextBlockBody render with green
    // markers and proper gap inside the iframe (the iframe doesn't
    // load the app's index.css).
    //
    // polish-9b-preview: inject a vanilla-JS click handler that
    // toggles `.flipcard-prev-flipped` on click. previewBlock.ts
    // case "flipcard" emits the markup with .flipcard-prev as the
    // outer class; CSS below applies the rotateY(180deg) transform
    // when the flipped class is present on the wrapper.
    const previewStyles = `
      body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #f6f7f8; color: ${b.tx}; }
      .hdr { background: ${b.grad}; padding: 22px 40px; color: #fff; }
      .hdr .crs { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
      .hdr .ttl { font-size: 22px; font-weight: 700; line-height: 1.3; }
      .bd { max-width: 760px; margin: 0 auto; padding: 36px 24px; }
      /* polish-6d-preview: numbered-line markers */
      .text-numbered-line { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 10px; }
      .text-numbered-marker { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: #00A651; color: white; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; }
      .text-numbered-content { flex: 1; line-height: 1.55; }
      .text-line { line-height: 1.55; margin-bottom: 4px; }
      .text-line:empty { display: none; }
      .text-line-spacer { height: 0.6em; }
      /* polish-9b-preview: flipcard flip-on-click */
      .flipcard-prev.flipcard-prev-flipped .flipcard-prev-inner { transform: rotateY(180deg); }
      .flipcard-prev:hover .flipcard-prev-inner { box-shadow: 0 4px 14px rgba(0,0,0,0.10); }
      /* polish-9b-preview-accordion: accordion expand/collapse with
         smooth max-height transition + chevron rotation. Mirrors
         the InteractiveAccordion behavior on the editor canvas
         (polish-9d) so editor and preview reads identically. */
      .accordion-prev-item {
        transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .accordion-prev-item-open {
        box-shadow: 0 4px 12px rgba(0, 166, 81, 0.10);
        border-color: rgba(0, 166, 81, 0.30) !important;
      }
      .accordion-prev-title {
        transition: background 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .accordion-prev-title:hover { background: rgba(0, 166, 81, 0.06) !important; }
      .accordion-prev-item-open .accordion-prev-title { background: rgba(0, 166, 81, 0.10) !important; }
      .accordion-prev-chevron {
        transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
        transform: rotate(0deg);
      }
      .accordion-prev-item-open .accordion-prev-chevron {
        transform: rotate(180deg);
        color: ${b.priDk} !important;
      }
      .accordion-prev-body {
        max-height: 0;
        padding: 0 16px;
        overflow: hidden;
        opacity: 0;
        transition: max-height 260ms cubic-bezier(0.4, 0, 0.2, 1),
                    padding 220ms cubic-bezier(0.4, 0, 0.2, 1),
                    opacity 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .accordion-prev-item-open .accordion-prev-body {
        max-height: 1000px;
        padding: 12px 16px;
        opacity: 1;
      }
    `;
    const previewScript = `
      // polish-9b-preview + polish-9b-preview-accordion: delegated
      // click handlers for both interactive block types. One listener
      // at the document level; class-match dispatch keeps the script
      // small and re-render safe.
      document.addEventListener('click', function(e) {
        if (!e.target || !e.target.closest) return;
        var card = e.target.closest('.flipcard-prev');
        if (card) { card.classList.toggle('flipcard-prev-flipped'); return; }
        var title = e.target.closest('.accordion-prev-title');
        if (title) {
          var item = title.closest('.accordion-prev-item');
          if (item) item.classList.toggle('accordion-prev-item-open');
          return;
        }
      });
    `;
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + previewStyles + '</style></head><body><div class="hdr"><div class="crs">' + esc(course.title) + '</div><div class="ttl">' + esc(lesson.title) + '</div></div><div class="bd">' + inner + '</div><script>' + previewScript + '</script></body></html>';
  }, [lesson, course]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/80 flex flex-col p-6">
      <div className="flex items-center justify-between text-white mb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Preview</div>
          <div className="text-base font-semibold">{lesson.title}</div>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-ink-300 hover:text-white">
          <X size={16} /> Close (Esc)
        </button>
      </div>
      <iframe srcDoc={src} title="Lesson preview" className="flex-1 w-full bg-white rounded-xl border-0" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING COPILOT
   ═══════════════════════════════════════════════════════════════════════════ */
function FloatingCopilot() {
  const { open, setOpen } = useAgent();

  if (open) {
    // AgentChat renders its own floating panel
    return <AgentChat />;
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-40 px-4 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition flex items-center gap-2"
    >
      <Sparkles size={16} />
      Copilot
    </button>
  );
}
