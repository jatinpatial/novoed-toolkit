import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { B, type BrandKey } from "../brand/tokens";
import { BTYPES, BDEFAULTS } from "../course/blockTypes";
import { previewBlock } from "../course/previewBlock";
import { exportLessonSCORM, exportCourseJSON, exportOutlineText } from "../course/exportLesson";
import type { Block, BlockData, BlockItem, Course, Lesson, Module } from "../course/types";
import { AgentProvider, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import { AgentChat } from "../agent/AgentChat";

const uid = () => "b" + Math.random().toString(36).slice(2, 10);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function toast(msg: string, ok = true) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:" + (ok === false ? "#ef4444" : "#197A56") + ";color:#fff;padding:10px 22px;border-radius:24px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);white-space:nowrap;";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.cssText += ";opacity:0;transition:opacity 0.4s;"; }, 1600);
  setTimeout(() => { t.parentNode && t.parentNode.removeChild(t); }, 2100);
}

function makeCourse(): Course {
  return {
    id: uid(),
    title: "Untitled Course",
    client: "",
    brand: "bcgu",
    modules: [{
      id: uid(),
      title: "Module 1",
      lessons: [{ id: uid(), title: "1.1 Introduction", duration: 5, blocks: [] }],
    }],
  };
}

function newItemForBlock(type: string): BlockItem {
  if (type === "quiz") return { title: "New option", desc: "0" };
  if (type === "poll") return { title: "New option", desc: "25" };
  if (type === "flipcard") return { title: "New card", img: "", desc: "Flip side content" };
  return { title: "New item", desc: "" };
}

type Screen = "home" | "builder";

export default function CourseBuilder() {
  return (
    <AgentProvider>
      <CourseBuilderInner />
    </AgentProvider>
  );
}

function CourseBuilderInner() {
  const [screen, setScreen] = useState<Screen>("home");
  const [course, setCourse] = useState<Course | null>(null);
  const [am, setAm] = useState(0);
  const [al, setAl] = useState(0);
  const [ab, setAb] = useState<string | null>(null);
  const didAutosave = useRef(false);

  useEffect(() => {
    if (!course) return;
    localStorage.setItem("bcgu_cb_" + course.id, JSON.stringify(course));
    didAutosave.current = true;
  }, [course]);

  function startNewCourse() {
    setCourse(makeCourse());
    setAm(0); setAl(0); setAb(null);
    setScreen("builder");
  }

  function importCourse() {
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
          setCourse(c);
          setAm(0); setAl(0); setAb(null);
          setScreen("builder");
          toast("✓ Course loaded: " + c.title);
        } catch {
          toast("Could not read file — is it a course JSON?", false);
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  function updateCourse(mut: (c: Course) => Course | void) {
    setCourse((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as Course;
      const result = mut(next);
      return result || next;
    });
  }

  function addModule() {
    updateCourse((c) => {
      const mi = c.modules.length + 1;
      c.modules.push({
        id: uid(),
        title: "Module " + mi,
        lessons: [{ id: uid(), title: mi + ".1 New Lesson", duration: 5, blocks: [] }],
      });
      setAm(c.modules.length - 1);
      setAl(0);
      setAb(null);
    });
  }

  function addLesson() {
    updateCourse((c) => {
      const mod = c.modules[am];
      const li = mod.lessons.length + 1;
      mod.lessons.push({ id: uid(), title: (am + 1) + "." + li + " New Lesson", duration: 5, blocks: [] });
      setAl(mod.lessons.length - 1);
      setAb(null);
    });
  }

  function addBlock(type: string) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const block: Block = { id: uid(), type, data: JSON.parse(JSON.stringify(BDEFAULTS[type] || {})) };
      les.blocks.push(block);
      setAb(block.id);
    });
  }

  function removeBlock(bid: string) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      les.blocks = les.blocks.filter((b) => b.id !== bid);
      setAb(null);
    });
  }

  function moveBlock(bid: string, dir: "up" | "dn") {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const i = les.blocks.findIndex((b) => b.id === bid);
      if (dir === "up" && i > 0) [les.blocks[i], les.blocks[i - 1]] = [les.blocks[i - 1], les.blocks[i]];
      if (dir === "dn" && i < les.blocks.length - 1) [les.blocks[i], les.blocks[i + 1]] = [les.blocks[i + 1], les.blocks[i]];
    });
  }

  function updateField(bid: string, field: string, value: unknown) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const blk = les.blocks.find((b) => b.id === bid);
      if (blk) (blk.data as Record<string, unknown>)[field] = value;
    });
  }

  function updateItem(bid: string, idx: number, field: string, value: unknown) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const blk = les.blocks.find((b) => b.id === bid);
      if (blk?.data.items && blk.data.items[idx]) {
        (blk.data.items[idx] as unknown as Record<string, unknown>)[field] = value;
      }
    });
  }

  function addItem(bid: string) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const blk = les.blocks.find((b) => b.id === bid);
      if (!blk || !blk.data.items) return;
      blk.data.items.push(newItemForBlock(blk.type));
    });
  }

  function removeItem(bid: string, idx: number) {
    updateCourse((c) => {
      const les = c.modules[am].lessons[al];
      const blk = les.blocks.find((b) => b.id === bid);
      if (!blk || !blk.data.items) return;
      const minItems = blk.type === "quiz" ? 2 : 1;
      if (blk.data.items.length <= minItems) {
        toast("Need at least " + minItems + " item(s)", false);
        return;
      }
      blk.data.items.splice(idx, 1);
    });
  }

  // --- Agent integration ---
  const navigate = useNavigate();
  const courseRef = useRef<Course | null>(null);
  courseRef.current = course;

  const findLesson = useCallback((c: Course, lessonId: string):
    | { mi: number; li: number; module: Module; lesson: Lesson }
    | null => {
    for (let mi = 0; mi < c.modules.length; mi++) {
      const module = c.modules[mi];
      for (let li = 0; li < module.lessons.length; li++) {
        if (module.lessons[li].id === lessonId) return { mi, li, module, lesson: module.lessons[li] };
      }
    }
    return null;
  }, []);

  const findBlock = useCallback((c: Course, blockId: string):
    | { mi: number; li: number; bi: number; block: Block }
    | null => {
    for (let mi = 0; mi < c.modules.length; mi++) {
      for (let li = 0; li < c.modules[mi].lessons.length; li++) {
        const blocks = c.modules[mi].lessons[li].blocks;
        for (let bi = 0; bi < blocks.length; bi++) {
          if (blocks[bi].id === blockId) return { mi, li, bi, block: blocks[bi] };
        }
      }
    }
    return null;
  }, []);

  const agentActions: AgentActions = {
    getCourse: () => courseRef.current,
    navigate: (route) => {
      if (route === "/" || route === "/course-builder") navigate(route);
    },
    setBrand: (brand) => updateCourse((c) => { c.brand = brand; }),
    addModule: (title) => {
      const id = uid();
      updateCourse((c) => {
        c.modules.push({ id, title, lessons: [{ id: uid(), title: "New Lesson", duration: 5, blocks: [] }] });
        setAm(c.modules.length - 1);
        setAl(0);
        setAb(null);
      });
      return { module_id: id };
    },
    addLesson: (moduleId, title, duration) => {
      const id = uid();
      updateCourse((c) => {
        const mi = c.modules.findIndex((m) => m.id === moduleId);
        if (mi < 0) throw new Error(`module not found: ${moduleId}`);
        c.modules[mi].lessons.push({ id, title, duration: duration ?? 5, blocks: [] });
        setAm(mi);
        setAl(c.modules[mi].lessons.length - 1);
        setAb(null);
      });
      return { lesson_id: id };
    },
    addBlock: (lessonId, blockType, data) => {
      const id = uid();
      const defaults = JSON.parse(JSON.stringify(BDEFAULTS[blockType] || {}));
      const merged = data ? { ...defaults, ...data } : defaults;
      updateCourse((c) => {
        const loc = findLesson(c, lessonId);
        if (!loc) throw new Error(`lesson not found: ${lessonId}`);
        loc.lesson.blocks.push({ id, type: blockType, data: merged });
        setAm(loc.mi);
        setAl(loc.li);
        setAb(id);
      });
      return { block_id: id };
    },
    updateBlock: (blockId, data) => {
      updateCourse((c) => {
        const loc = findBlock(c, blockId);
        if (!loc) throw new Error(`block not found: ${blockId}`);
        loc.block.data = { ...loc.block.data, ...(data as BlockData) };
        setAm(loc.mi);
        setAl(loc.li);
        setAb(blockId);
      });
    },
    deleteBlock: (blockId) => {
      updateCourse((c) => {
        const loc = findBlock(c, blockId);
        if (!loc) throw new Error(`block not found: ${blockId}`);
        c.modules[loc.mi].lessons[loc.li].blocks.splice(loc.bi, 1);
        if (ab === blockId) setAb(null);
      });
    },
    reorder: (kind, id, newIndex) => {
      updateCourse((c) => {
        if (kind === "module") {
          const idx = c.modules.findIndex((m) => m.id === id);
          if (idx < 0) throw new Error(`module not found: ${id}`);
          const [m] = c.modules.splice(idx, 1);
          c.modules.splice(clamp(newIndex, 0, c.modules.length), 0, m);
        } else if (kind === "lesson") {
          for (const mod of c.modules) {
            const idx = mod.lessons.findIndex((l) => l.id === id);
            if (idx >= 0) {
              const [l] = mod.lessons.splice(idx, 1);
              mod.lessons.splice(clamp(newIndex, 0, mod.lessons.length), 0, l);
              return;
            }
          }
          throw new Error(`lesson not found: ${id}`);
        } else {
          const loc = findBlock(c, id);
          if (!loc) throw new Error(`block not found: ${id}`);
          const blocks = c.modules[loc.mi].lessons[loc.li].blocks;
          const [b] = blocks.splice(loc.bi, 1);
          blocks.splice(clamp(newIndex, 0, blocks.length), 0, b);
        }
      });
    },
    exportLesson: (lessonId, format) => {
      const c = courseRef.current;
      if (!c) throw new Error("no course loaded");
      const loc = findLesson(c, lessonId);
      if (!loc) throw new Error(`lesson not found: ${lessonId}`);
      if (format === "scorm") exportLessonSCORM(c, loc.lesson);
      else exportCourseJSON(c);
    },
  };
  useRegisterAgentActions(agentActions);

  if (screen === "home" || !course) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F0F2F5" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 44, maxWidth: 500, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#29BA74,#1B7A4F)", borderRadius: 16, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📚</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>BCG U Course Builder</div>
          <div style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>Design full learning journeys with video, interactives & quizzes.<br />Export each lesson as a SCORM package for NovoEd.</div>
          <button onClick={startNewCourse} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, background: "linear-gradient(135deg,#29BA74,#1B7A4F)", color: "#fff", boxShadow: "0 4px 16px rgba(41,186,116,0.3)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, background: "rgba(255,255,255,0.25)" }}>+</div>
            <div>
              <div>New Course</div>
              <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 400, marginTop: 1 }}>Start from scratch</div>
            </div>
          </button>
          <button onClick={importCourse} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, marginBottom: 8, background: "#F5F5F5", color: "#333" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, background: "#E8E8E8" }}>⬆</div>
            <div>
              <div>Import Course</div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400, marginTop: 1 }}>Load a saved .json file</div>
            </div>
          </button>
          <Link to="/" style={{ width: "100%", padding: "14px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "#F5F5F5", color: "#333", boxSizing: "border-box" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, background: "#E8E8E8" }}>⚙</div>
            <div>
              <div>Component Toolkit</div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400, marginTop: 1 }}>Individual HTML & SCORM components</div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return <BuilderScreen
    course={course}
    am={am}
    al={al}
    ab={ab}
    onSetAm={setAm}
    onSetAl={setAl}
    onSetAb={setAb}
    onUpdateCourse={updateCourse}
    onAddModule={addModule}
    onAddLesson={addLesson}
    onAddBlock={addBlock}
    onRemoveBlock={removeBlock}
    onMoveBlock={moveBlock}
    onUpdateField={updateField}
    onUpdateItem={updateItem}
    onAddItem={addItem}
    onRemoveItem={removeItem}
    onHome={() => setScreen("home")}
  />;
}

interface BuilderProps {
  course: Course;
  am: number;
  al: number;
  ab: string | null;
  onSetAm: (n: number) => void;
  onSetAl: (n: number) => void;
  onSetAb: (s: string | null) => void;
  onUpdateCourse: (mut: (c: Course) => Course | void) => void;
  onAddModule: () => void;
  onAddLesson: () => void;
  onAddBlock: (t: string) => void;
  onRemoveBlock: (id: string) => void;
  onMoveBlock: (id: string, dir: "up" | "dn") => void;
  onUpdateField: (bid: string, field: string, v: unknown) => void;
  onUpdateItem: (bid: string, idx: number, field: string, v: unknown) => void;
  onAddItem: (bid: string) => void;
  onRemoveItem: (bid: string, idx: number) => void;
  onHome: () => void;
}

function BuilderScreen(p: BuilderProps) {
  const { course, am, al, ab } = p;
  const b = B[course.brand] || B.bcgu;
  const mod: Module | undefined = course.modules[am] || course.modules[0];
  const les: Lesson | undefined = mod ? mod.lessons[al] || mod.lessons[0] : undefined;
  const activeBlk = les?.blocks.find((bl) => bl.id === ab) || null;

  const doExportSCORM = () => {
    if (!les) { toast("Select a lesson first", false); return; }
    try {
      exportLessonSCORM(course, les);
      toast("✓ SCORM package ready");
    } catch {
      toast("Export failed", false);
    }
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#F0F2F5", fontFamily: "'Inter',system-ui,sans-serif", color: "#1a1a2e" }}>
      {/* Header */}
      <div style={{ height: 52, background: "#fff", borderBottom: "1px solid #E8E8E8", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 30, height: 30, background: b.grad, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📚</div>
        <input
          value={course.title}
          onChange={(e) => p.onUpdateCourse((c) => { c.title = e.target.value; })}
          placeholder="Course title..."
          style={{ flex: 1, fontSize: 14, fontWeight: 700, border: "none", outline: "none", background: "transparent", color: "#1a1a2e", minWidth: 0 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>BRAND</span>
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(B) as BrandKey[]).map((k) => (
              <button
                key={k}
                onClick={() => p.onUpdateCourse((c) => { c.brand = k; })}
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "1.5px solid " + (course.brand === k ? b.pri : "#E8E8E8"),
                  background: course.brand === k ? b.pri : "#fff",
                  color: course.brand === k ? "#fff" : "#888",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {B[k].n}
              </button>
            ))}
          </div>
          <button onClick={() => exportOutlineText(course)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#F5F5F5", color: "#555" }}>📄 Outline</button>
          <button onClick={() => exportCourseJSON(course)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#F5F5F5", color: "#555" }}>💾 Save JSON</button>
          <button onClick={doExportSCORM} title="Export current lesson as SCORM 1.2 ZIP" style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg,#29BA74,#1B7A4F)", color: "#fff", boxShadow: "0 2px 8px rgba(41,186,116,0.3)" }}>⬆ Export SCORM</button>
          <button onClick={p.onHome} style={{ background: "none", border: "none", color: "#bbb", fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1, marginLeft: 2 }}>×</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left outline */}
        <div style={{ width: 232, background: "#fff", borderRight: "1px solid #E8E8E8", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E8E8E8", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2 }}>Course Outline</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {course.modules.map((mod2, mi) => (
              <div key={mod2.id}>
                <div style={{ padding: "8px 14px 2px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 16, height: 16, background: "#1a1a2e", borderRadius: 3, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{mi + 1}</span>
                    <input
                      value={mod2.title}
                      onChange={(e) => p.onUpdateCourse((c) => { c.modules[mi].title = e.target.value; })}
                      onClick={() => { p.onSetAm(mi); p.onSetAl(0); p.onSetAb(null); }}
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 11, fontWeight: 700, color: "#1a1a2e" }}
                    />
                  </div>
                </div>
                {mod2.lessons.map((les2, li) => {
                  const act = am === mi && al === li;
                  return (
                    <div
                      key={les2.id}
                      onClick={() => { p.onSetAm(mi); p.onSetAl(li); p.onSetAb(null); }}
                      style={{ padding: "4px 14px 4px 36px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: act ? "#E6F7EF" : undefined }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#29BA74", flexShrink: 0 }}>{mi + 1}.{li + 1}</span>
                      <span style={{ fontSize: 11, color: act ? "#1B7A4F" : "#555", fontWeight: act ? 600 : 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{les2.title.replace(/^\d+\.\d+\s*/, "")}</span>
                      <span style={{ fontSize: 9, color: "#ccc", marginLeft: "auto" }}>{les2.duration}m</span>
                    </div>
                  );
                })}
                <button onClick={() => { p.onSetAm(mi); p.onAddLesson(); }} style={{ padding: "5px 14px", border: "none", background: "none", fontSize: 10, color: "#bbb", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, width: "100%" }}>＋ lesson</button>
              </div>
            ))}
            <button onClick={p.onAddModule} style={{ padding: "10px 14px 5px", borderTop: "1px solid #F0F2F5", marginTop: 6, background: "none", border: "none", fontSize: 10, color: "#bbb", textAlign: "left", cursor: "pointer", width: "100%", display: "flex", alignItems: "center", gap: 4 }}>＋ module</button>
          </div>
        </div>

        {/* Center editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F0F2F5" }}>
          {les ? (
            <>
              <div style={{ padding: "10px 18px", background: "#fff", borderBottom: "1px solid #E8E8E8", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <input
                  value={les.title}
                  onChange={(e) => p.onUpdateCourse((c) => { c.modules[am].lessons[al].title = e.target.value; })}
                  placeholder="Lesson title..."
                  style={{ flex: 1, fontSize: 14, fontWeight: 600, border: "none", outline: "none", color: "#1a1a2e", background: "transparent" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "#bbb" }}>Duration</span>
                  <input
                    type="number"
                    value={les.duration}
                    min={1}
                    onChange={(e) => p.onUpdateCourse((c) => { c.modules[am].lessons[al].duration = parseInt(e.target.value) || 5; })}
                    style={{ width: 46, padding: "4px 6px", border: "1.5px solid #E8E8E8", borderRadius: 6, fontSize: 11, fontWeight: 600, textAlign: "center" }}
                  />
                  <span style={{ fontSize: 10, color: "#bbb" }}>mins</span>
                  <button onClick={doExportSCORM} title="Export this lesson as SCORM" style={{ marginLeft: 4, padding: "5px 10px", borderRadius: 6, border: "1.5px solid #E8E8E8", background: "#fff", fontSize: 10, fontWeight: 600, color: "#555", cursor: "pointer" }}>⬆ Export</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {les.blocks.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#ccc" }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🧱</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>This lesson is empty.<br />Add your first block below.</div>
                  </div>
                )}

                {les.blocks.map((blk) => {
                  const bt = BTYPES.find((t) => t.id === blk.type) || { label: blk.type, col: "#aaa", icon: "?", id: blk.type };
                  const isSel = ab === blk.id;
                  return (
                    <div
                      key={blk.id}
                      onClick={() => p.onSetAb(ab === blk.id ? null : blk.id)}
                      style={{ background: "#fff", borderRadius: 12, border: "1.5px solid " + (isSel ? "#29BA74" : "#E8E8E8"), marginBottom: 10, cursor: "pointer", boxShadow: isSel ? "0 0 0 3px rgba(41,186,116,0.12)" : undefined }}
                    >
                      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid #F5F5F5" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: bt.col, flexShrink: 0 }}></span>
                        <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, background: bt.col + "18", color: bt.col }}>{bt.label}</span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                          <button onClick={(e) => { e.stopPropagation(); p.onMoveBlock(blk.id, "up"); }} title="Move up" style={{ width: 22, height: 22, border: "none", background: "none", color: "#ccc", cursor: "pointer", borderRadius: 4, fontSize: 11 }}>↑</button>
                          <button onClick={(e) => { e.stopPropagation(); p.onMoveBlock(blk.id, "dn"); }} title="Move down" style={{ width: 22, height: 22, border: "none", background: "none", color: "#ccc", cursor: "pointer", borderRadius: 4, fontSize: 11 }}>↓</button>
                          <button onClick={(e) => { e.stopPropagation(); p.onRemoveBlock(blk.id); }} title="Remove" style={{ width: 22, height: 22, border: "none", background: "none", color: "#fca5a5", cursor: "pointer", borderRadius: 4, fontSize: 11 }}>✕</button>
                        </div>
                      </div>
                      <div style={{ padding: 14 }} dangerouslySetInnerHTML={{ __html: previewBlock(blk, course.brand) }} />
                    </div>
                  );
                })}

                <div style={{ padding: "12px 0 24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 10 }}>Add a block</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                    {BTYPES.map((bt) => (
                      <button key={bt.id} onClick={() => p.onAddBlock(bt.id)} title={bt.label} style={{ padding: "11px 6px", border: "1.5px solid #E8E8E8", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "center" }}>
                        <div style={{ fontSize: 16, marginBottom: 3, color: bt.col }}>{bt.icon}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#666" }}>{bt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#ccc", margin: "auto" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👈</div>
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>Select a lesson<br />from the outline</div>
            </div>
          )}
        </div>

        {/* AI companion */}
        <AgentChat />

        {/* Right settings */}
        <div style={{ width: 256, background: "#fff", borderLeft: "1px solid #E8E8E8", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E8E8E8", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.2 }}>Block Settings</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            <SettingsPanel
              block={activeBlk}
              onUpdateField={p.onUpdateField}
              onUpdateItem={p.onUpdateItem}
              onAddItem={p.onAddItem}
              onRemoveItem={p.onRemoveItem}
              onRemoveBlock={p.onRemoveBlock}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsProps {
  block: Block | null;
  onUpdateField: (bid: string, field: string, v: unknown) => void;
  onUpdateItem: (bid: string, idx: number, field: string, v: unknown) => void;
  onAddItem: (bid: string) => void;
  onRemoveItem: (bid: string, idx: number) => void;
  onRemoveBlock: (bid: string) => void;
}

function SettingsPanel({ block, onUpdateField, onUpdateItem, onAddItem, onRemoveItem, onRemoveBlock }: SettingsProps) {
  if (!block) {
    return (
      <div style={{ textAlign: "center", padding: "40px 16px", color: "#ccc" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>👆</div>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>Click any block<br />to edit its settings</div>
      </div>
    );
  }
  const d = block.data || {};
  const bid = block.id;
  const items = d.items || [];

  const labelStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, marginTop: 10, display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 9px", border: "1.5px solid #E8E8E8", borderRadius: 7, fontSize: 12, color: "#1a1a2e", background: "#fff" };
  const itemStyle: React.CSSProperties = { background: "#F5F5F5", borderRadius: 7, padding: "7px 9px", marginBottom: 5, position: "relative" };
  const rmStyle: React.CSSProperties = { position: "absolute", top: 5, right: 5, width: 16, height: 16, border: "none", background: "none", color: "#ccc", cursor: "pointer", borderRadius: 3, fontSize: 10, lineHeight: 1 };
  const addStyle: React.CSSProperties = { width: "100%", padding: 7, border: "1.5px dashed #E8E8E8", borderRadius: 7, background: "none", fontSize: 11, color: "#aaa", cursor: "pointer", marginTop: 4 };

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1a1a2e", paddingBottom: 10, borderBottom: "1px solid #E8E8E8", marginBottom: 2 }}>
        {block.type.toUpperCase()} BLOCK
      </div>

      {block.type === "text" && (
        <>
          <span style={labelStyle}>Content</span>
          <textarea style={{ ...inputStyle, minHeight: 160, resize: "vertical" }} value={d.content || ""} onChange={(e) => onUpdateField(bid, "content", e.target.value)} />
        </>
      )}

      {block.type === "video" && (
        <>
          <span style={labelStyle}>Video URL (YouTube / Vimeo)</span>
          <input style={inputStyle} value={d.url || ""} onChange={(e) => onUpdateField(bid, "url", e.target.value)} placeholder="https://..." />
          <span style={labelStyle}>Caption</span>
          <input style={inputStyle} value={d.caption || ""} onChange={(e) => onUpdateField(bid, "caption", e.target.value)} placeholder="Optional" />
        </>
      )}

      {block.type === "image" && (
        <>
          <span style={labelStyle}>Image URL</span>
          <input style={inputStyle} value={d.url || ""} onChange={(e) => onUpdateField(bid, "url", e.target.value)} placeholder="https://..." />
          <span style={labelStyle}>Caption</span>
          <input style={inputStyle} value={d.caption || ""} onChange={(e) => onUpdateField(bid, "caption", e.target.value)} placeholder="Optional" />
        </>
      )}

      {block.type === "banner" && (
        <>
          <span style={labelStyle}>Title</span>
          <input style={inputStyle} value={d.title || ""} onChange={(e) => onUpdateField(bid, "title", e.target.value)} />
          <span style={labelStyle}>Body</span>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={d.body || ""} onChange={(e) => onUpdateField(bid, "body", e.target.value)} />
        </>
      )}

      {block.type === "callout" && (
        <>
          <span style={labelStyle}>Type</span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
            {["info", "tip", "warning", "success"].map((t) => {
              const on = d.type === t;
              return (
                <button key={t} onClick={() => onUpdateField(bid, "type", t)} style={{ padding: "3px 10px", borderRadius: 20, border: "1.5px solid " + (on ? "#29BA74" : "#E8E8E8"), background: on ? "#29BA74" : "#fff", fontSize: 10, fontWeight: 600, color: on ? "#fff" : "#888", cursor: "pointer" }}>{t}</button>
              );
            })}
          </div>
          <span style={labelStyle}>Message</span>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={d.body || ""} onChange={(e) => onUpdateField(bid, "body", e.target.value)} />
        </>
      )}

      {(block.type === "cards" || block.type === "stats") && (
        <>
          <span style={labelStyle}>Items</span>
          {items.map((it, i) => (
            <div key={i} style={itemStyle}>
              <button style={rmStyle} onClick={() => onRemoveItem(bid, i)}>✕</button>
              <input style={{ ...inputStyle, marginBottom: 4, paddingRight: 22 }} value={it.title || ""} onChange={(e) => onUpdateItem(bid, i, "title", e.target.value)} placeholder="Title" />
              {it.desc !== undefined && <input style={inputStyle} value={it.desc || ""} onChange={(e) => onUpdateItem(bid, i, "desc", e.target.value)} placeholder="Label / description" />}
            </div>
          ))}
          <button style={addStyle} onClick={() => onAddItem(bid)}>＋ Add item</button>
        </>
      )}

      {(block.type === "accordion" || block.type === "timeline") && (
        <>
          <span style={labelStyle}>Items</span>
          {items.map((it, i) => (
            <div key={i} style={itemStyle}>
              <button style={rmStyle} onClick={() => onRemoveItem(bid, i)}>✕</button>
              <input style={{ ...inputStyle, marginBottom: 4, paddingRight: 22 }} value={it.title || ""} onChange={(e) => onUpdateItem(bid, i, "title", e.target.value)} placeholder="Title" />
              <textarea style={{ ...inputStyle, minHeight: 54, resize: "vertical" }} value={it.desc || ""} onChange={(e) => onUpdateItem(bid, i, "desc", e.target.value)} placeholder="Content" />
            </div>
          ))}
          <button style={addStyle} onClick={() => onAddItem(bid)}>＋ Add item</button>
        </>
      )}

      {block.type === "flipcard" && (
        <>
          <span style={labelStyle}>Cards (click to flip in the SCORM)</span>
          {items.map((it, i) => (
            <div key={i} style={itemStyle}>
              <button style={rmStyle} onClick={() => onRemoveItem(bid, i)}>✕</button>
              <input style={{ ...inputStyle, marginBottom: 4, paddingRight: 22 }} value={it.title || ""} onChange={(e) => onUpdateItem(bid, i, "title", e.target.value)} placeholder="Front title" />
              <textarea style={{ ...inputStyle, minHeight: 54, resize: "vertical" }} value={it.desc || ""} onChange={(e) => onUpdateItem(bid, i, "desc", e.target.value)} placeholder="Back content" />
            </div>
          ))}
          <button style={addStyle} onClick={() => onAddItem(bid)}>＋ Add card</button>
        </>
      )}

      {block.type === "quiz" && (
        <>
          <span style={labelStyle}>Question</span>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={items[0]?.title || ""} onChange={(e) => onUpdateItem(bid, 0, "title", e.target.value)} />
          <span style={labelStyle}>Options — ✓ marks correct answer</span>
          {items.slice(1).map((it, i) => {
            const ok = it.desc === "1";
            return (
              <div key={i} style={{ ...itemStyle, paddingRight: 6 }}>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <button onClick={() => onUpdateItem(bid, i + 1, "desc", ok ? "0" : "1")} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 6, border: "1.5px solid " + (ok ? "#22c55e" : "#E8E8E8"), background: ok ? "#f0fdf4" : "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ok ? "✓" : "○"}</button>
                  <input style={{ ...inputStyle, flex: 1 }} value={it.title || ""} onChange={(e) => onUpdateItem(bid, i + 1, "title", e.target.value)} placeholder={"Option " + (i + 1)} />
                  <button onClick={() => onRemoveItem(bid, i + 1)} style={{ ...rmStyle, position: "relative", top: "auto", right: "auto" }}>✕</button>
                </div>
              </div>
            );
          })}
          <button style={addStyle} onClick={() => onAddItem(bid)}>＋ Add option</button>
        </>
      )}

      {block.type === "poll" && (
        <>
          <span style={labelStyle}>Title</span>
          <input style={inputStyle} value={d.title || ""} onChange={(e) => onUpdateField(bid, "title", e.target.value)} />
          <span style={labelStyle}>Options + result % for preview</span>
          {items.map((it, i) => (
            <div key={i} style={itemStyle}>
              <button style={rmStyle} onClick={() => onRemoveItem(bid, i)}>✕</button>
              <div style={{ display: "flex", gap: 5 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={it.title || ""} onChange={(e) => onUpdateItem(bid, i, "title", e.target.value)} placeholder="Option" />
                <input style={{ ...inputStyle, width: 50, textAlign: "center" }} value={it.desc || "25"} onChange={(e) => onUpdateItem(bid, i, "desc", e.target.value)} placeholder="%" />
              </div>
            </div>
          ))}
          <button style={addStyle} onClick={() => onAddItem(bid)}>＋ Add option</button>
        </>
      )}

      {block.type === "divider" && (
        <>
          <span style={labelStyle}>Label (optional)</span>
          <input style={inputStyle} value={d.title || ""} onChange={(e) => onUpdateField(bid, "title", e.target.value)} placeholder="e.g. Key Concepts" />
        </>
      )}

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #E8E8E8" }}>
        <button onClick={() => onRemoveBlock(bid)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fef2f2", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑 Remove this block</button>
      </div>
    </>
  );
}
