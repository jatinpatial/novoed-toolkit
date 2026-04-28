import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, X, MoreHorizontal, ArrowUp, ArrowDown, Trash2, Copy, Settings2, ChevronLeft, ChevronRight,
  Save, Check, Download, FileJson, FileText, Eye, Sparkles, MessageSquare, BookOpen, PlayCircle, Home, Type,
  Video, Image as ImageIcon, Rows3, Hash, ListChecks, Layers, Clock, HelpCircle, BarChart3, Minus, AlertCircle,
  Maximize2, Minimize2, LucideProps
} from "lucide-react";
import { Sidebar } from "../shell/Sidebar";
import { TopBar, useActiveBrand } from "../shell/TopBar";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { B, type BrandKey } from "../brand/tokens";
import { BTYPES, BDEFAULTS } from "../course/blockTypes";
import { previewBlock } from "../course/previewBlock";
import { exportLessonSCORM, exportCourseJSON, exportOutlineText } from "../course/exportLesson";
import type { Block, BlockData, BlockItem, CaseStudy, Course, Lesson, Material, Module, Quiz, QuizQuestion } from "../course/types";
import { deleteProject, getProject, listProjects, saveProject, subscribeProjects, uid, type Project } from "../store/projects";
import { AgentProvider, useAgent, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import { AgentChat } from "../agent/AgentChat";
import { CourseOutlineProposalCard } from "../agent/CourseOutlineProposal";
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
  const { outlineProposal, setOutlineProposal, clearOutlineProposal, setOpen: setChatOpen } = useAgent();

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

  function handleBuild() {
    if (!outlineProposal) return;
    const course = buildCourseFromProposal(outlineProposal, brand);
    const id = uid();
    saveProject({ id, name: course.title, kind: "course", brand, data: { kind: "course", course } });
    clearOutlineProposal();
    onOpen(course, id);
    toast("Course built — fill in the lessons next");
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
            title="Design full learning journeys."
            subtitle="Tell the Copilot what course you want to build, or start from scratch and import existing work."
            actions={
              <>
                <button onClick={handleImport} className="btn-secondary btn-sm"><FileJson size={14} /> Import JSON</button>
                <button onClick={handleNew} className="btn-primary btn-sm"><Plus size={14} /> New course</button>
              </>
            }
          />

          {outlineProposal && (
            <div className="mb-6">
              <CourseOutlineProposalCard
                proposal={outlineProposal}
                onBuild={handleBuild}
                onDiscard={clearOutlineProposal}
              />
            </div>
          )}

          {!outlineProposal && projects.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={24} />}
              title="No courses yet"
              description="Open the Copilot and describe a course — topic, audience, duration in weeks. The Course Architect proposes a weekly outline you can build with one click."
              action={
                <div className="flex gap-2">
                  <button onClick={() => setChatOpen(true)} className="btn-primary btn-sm"><Sparkles size={14} /> Open Copilot</button>
                  <button onClick={handleImport} className="btn-secondary btn-sm">Import JSON</button>
                  <button onClick={handleNew} className="btn-secondary btn-sm">Start blank</button>
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
  // Canvas mode. "lesson" shows the lesson editor; "module" shows the
  // module summary page (week/objectives/final assessment/case study).
  // Switched by clicking the module row vs a lesson row in the outline.
  const [viewMode, setViewMode] = useState<"lesson" | "module">("lesson");
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
            l.blocks.push({
              id: rid(),
              type: b.type,
              data: { content: b.content },
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
      for (let mi = 0; mi < course.modules.length; mi++) {
        const m = course.modules[mi];
        for (let li = 0; li < m.lessons.length; li++) {
          const l = m.lessons[li];
          if (l.blocks.some((b) => b.id === blockId)) {
            setAm(mi);
            setAl(li);
            setEditingBlockId(blockId);
            return;
          }
        }
      }
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

        {/* Canvas */}
        <div className="flex-1 min-w-0 overflow-y-auto">
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
function CourseTopBar({ course, lesson, onTitleChange, onBrandChange, onPreview, onExportScorm, onExportJson, onExportOutline, onClose, projectId }: any) {
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
    <header className="h-14 bg-white border-b border-ink-200 flex items-center px-4 gap-3 flex-shrink-0">
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
          className="max-w-md text-base font-bold text-ink-900 bg-transparent border-none outline-none text-center px-2 h-8 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus"
        />
        {lesson && (
          <>
            <span className="text-ink-300 text-sm">/</span>
            <span className="text-sm font-medium text-ink-500 truncate max-w-xs">{lesson.title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[11px] font-medium flex items-center gap-1 ${saved ? "text-ink-400" : "text-brand-700"}`}>
          {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Saving…</>}
        </span>

        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100">
          {(Object.keys(B) as BrandKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onBrandChange(k)}
              className={`px-2 h-7 rounded text-[11px] font-semibold transition ${course.brand === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
            >
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

      {leftPane === "outline" ? (
        <CourseOutlineBody course={course} am={am} al={al} viewMode={viewMode} onSelect={onSelect} onSelectModule={onSelectModule} onUpdate={onUpdate} />
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
function CourseOutlineBody({ course, am, al, viewMode, onSelect, onSelectModule, onUpdate }: any) {
  function addModule() {
    onUpdate((c: Course) => {
      const mi = c.modules.length + 1;
      c.modules.push({ id: rid(), title: "Module " + mi, lessons: [{ id: rid(), title: mi + ".1 New Lesson", duration: 5, blocks: [] }] });
    });
  }

  function addLesson(mi: number) {
    onUpdate((c: Course) => {
      const m = c.modules[mi];
      if (!m) return;
      const li = m.lessons.length + 1;
      m.lessons.push({ id: rid(), title: (mi + 1) + "." + li + " New lesson", duration: 5, blocks: [] });
    });
  }

  function removeLesson(mi: number, li: number) {
    onUpdate((c: Course) => {
      const m = c.modules[mi];
      if (!m || m.lessons.length <= 1) return;
      m.lessons.splice(li, 1);
    });
  }

  function removeModule(mi: number) {
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
          return (
          <div key={m.id} className="mb-1">
            <div className={`px-3 pt-2 pb-1 flex items-center gap-1.5 group ${moduleActive ? "bg-brand-50/60 rounded-md mx-2" : ""}`}>
              <button
                onClick={() => onSelectModule(mi)}
                className={`w-5 h-5 flex-shrink-0 rounded text-[9px] font-bold flex items-center justify-center transition ${moduleActive ? "bg-brand-600 text-white" : "bg-ink-900 text-white hover:bg-brand-700"}`}
                title="Open module summary"
              >
                {mi + 1}
              </button>
              <input
                value={m.title}
                onChange={(e) => onUpdate((c: Course) => { c.modules[mi].title = e.target.value; })}
                onClick={(e) => e.stopPropagation()}
                className={`flex-1 text-xs font-bold bg-transparent border-none outline-none min-w-0 ${moduleActive ? "text-brand-800" : "text-ink-900"}`}
              />
              {m.caseStudyId && (() => {
                const cs = course.caseStudies?.find((c: CaseStudy) => c.id === m.caseStudyId);
                const designed = !!cs && (cs.context.trim().length > 0 || cs.stakeholders.length > 0);
                const tip = cs
                  ? `Case study${designed ? "" : " (planted, not yet designed)"}: ${cs.title}`
                  : "Case study slot";
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectModule(mi); }}
                    title={tip}
                    className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition ${designed ? "text-brand-700 hover:bg-brand-50" : "text-ink-400 hover:text-brand-700 hover:bg-brand-50"}`}
                  >
                    <BookOpen size={11} />
                  </button>
                );
              })()}
              {course.modules.length > 1 && (
                <button
                  onClick={() => { if (confirm("Delete module '" + m.title + "'?")) removeModule(mi); }}
                  className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500"
                  title="Delete module"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            {m.lessons.map((l: any, li: number) => {
              const active = am === mi && al === li;
              return (
                <div key={l.id} className={`group mx-2 rounded-md flex items-center gap-1.5 pl-7 pr-2 py-1.5 cursor-pointer ${active ? "bg-brand-50" : "hover:bg-ink-50"}`}
                  onClick={() => onSelect(mi, li)}
                >
                  <span className={`text-[10px] font-bold flex-shrink-0 ${active ? "text-brand-700" : "text-ink-400"}`}>{mi + 1}.{li + 1}</span>
                  <span className={`text-[12px] flex-1 truncate ${active ? "text-brand-800 font-semibold" : "text-ink-700"}`}>
                    {l.title.replace(/^\d+\.\d+\s*/, "")}
                  </span>
                  <span className="text-[10px] text-ink-300">{l.blocks.length}</span>
                  {m.lessons.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm("Delete lesson?")) removeLesson(mi, li); }}
                      className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
            <button onClick={() => addLesson(mi)} className="mx-2 mt-0.5 px-7 py-1 text-[11px] text-ink-400 hover:text-brand-700 rounded hover:bg-brand-50 w-[calc(100%-16px)] text-left">
              + lesson
            </button>
          </div>
          );
        })}
      </div>

      <button onClick={addModule} className="mx-3 my-3 py-2 rounded-lg border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50 transition flex items-center justify-center gap-1.5">
        <Plus size={12} /> Add module
      </button>
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

function LessonCanvas({ lesson, module: mod, brand, am, al, onUpdateLesson, onUpdateBlock, onAddBlock, onRemoveBlock, onMoveBlock, onDuplicateBlock, onEditBlock, insertAt, setInsertAt }: any) {
  const { setOpen: setChatOpen, prefillInput } = useAgent();
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

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Lesson header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Lesson</div>
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
          className="w-full text-3xl font-bold text-ink-900 bg-transparent border-none outline-none mb-2 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus"
        />
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-ink-400" />
            <input
              type="number"
              value={lesson.duration}
              min={1}
              onChange={(e) => onUpdateLesson((l: Lesson) => { l.duration = parseInt(e.target.value) || 5; })}
              className="w-10 bg-transparent border-none outline-none text-xs font-medium"
            />
            <span>minutes</span>
          </div>
          <span>·</span>
          <span>{lesson.blocks.length} block{lesson.blocks.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Blocks */}
      {lesson.blocks.length === 0 ? (
        <div className="py-10 space-y-6">
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
                Have the Copilot draft a Hook → Body → Examples → Summary based on the title and objectives. You'll be able to edit the chat message before sending.
              </div>
            </div>
          </button>
          <BlockInsertRow onPick={(t) => onAddBlock(t)} expanded />
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

      {/* Knowledge check section — separate from blocks. Lives below the
          lesson body. Empty state shows a CTA; filled state shows the
          questions with per-question regen affordance. */}
      <div className="mt-12">
        <KnowledgeCheckSection
          quiz={lesson.knowledgeCheck}
          onWrite={() => triggerKnowledgeCheck("write")}
          onRegenerateAll={() => triggerKnowledgeCheck("regenerate")}
          onRegenerateQuestion={triggerQuestionRegen}
        />
      </div>
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
  const categories: { label: string; ids: string[] }[] = [
    { label: "Text & media", ids: ["text", "banner", "callout", "image", "video", "divider"] },
    { label: "Data", ids: ["cards", "stats", "timeline", "accordion", "flipcard"] },
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
  const isSimple = ["text", "banner", "callout", "divider"].includes(block.type);
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
          ) : (
            <div onClick={onOpenEditor} className="cursor-pointer" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIMPLE BLOCK INLINE EDITORS
   ═══════════════════════════════════════════════════════════════════════════ */
function SimpleBlockEditor({ block, brand, onChange }: { block: Block; brand: BrandKey; onChange: (field: string, val: any) => void }) {
  const b = B[brand];
  const d = block.data || {};

  if (block.type === "text") {
    return (
      <textarea
        value={d.content || ""}
        onChange={(e) => onChange("content", e.target.value)}
        rows={Math.max(3, (d.content || "").split("\n").length)}
        placeholder="Start writing..."
        className="w-full text-[15px] leading-relaxed text-ink-900 bg-transparent border-none outline-none resize-none placeholder:text-ink-300"
      />
    );
  }

  if (block.type === "banner") {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: b.grad }}>
        <div className="p-6">
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
            className="w-full text-sm text-white/90 bg-transparent border-none outline-none resize-none placeholder:text-white/40"
          />
        </div>
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
            <textarea
              value={d.body || ""}
              onChange={(e) => onChange("body", e.target.value)}
              rows={2}
              placeholder="Your message..."
              className="w-full text-sm text-ink-800 bg-transparent border-none outline-none resize-none placeholder:text-ink-400"
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Inter,system-ui,sans-serif;margin:0;background:#f6f7f8;color:${b.tx}}.hdr{background:${b.grad};padding:22px 40px;color:#fff}.hdr .crs{font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}.hdr .ttl{font-size:22px;font-weight:700;line-height:1.3}.bd{max-width:760px;margin:0 auto;padding:36px 24px}</style></head><body><div class="hdr"><div class="crs">${course.title}</div><div class="ttl">${lesson.title}</div></div><div class="bd">${inner}</div></body></html>`;
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
