import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mic } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import {
  AgentProvider,
  useAgent,
  useRegisterAgentActions,
  type AgentActions,
} from "../agent/AgentContext";
import { AgentChat } from "../agent/AgentChat";
import { useActiveBrand } from "../shell/TopBar";
import { getScript, saveScript, subscribeScripts, type Script } from "../store/scripts";
import type { Course } from "../course/types";

/**
 * ScriptStudio — dedicated surface for standalone Synthesia scripts
 * (polish-4a). The /scripts/:id page renders a focused script editor
 * + Studio Copilot chat WITHOUT the full Course Studio chrome
 * (outline tree, lesson canvas, brand toggle, export menu).
 *
 * Pre-polish-4a, /scripts/new submitted into a fake 1-module-1-lesson
 * course so the existing Synthesia Scriptwriter (MODE 3) tool path
 * could find a video block. polish-4a separates the data model:
 * Script lives in its own localStorage namespace, ScriptStudio
 * renders the right surface. The agent integration still uses the
 * existing MODE 3 path — ScriptStudio constructs a SYNTHETIC course
 * wrapper around the Script (one module, one lesson, one video block
 * whose id = script.id) so list_structure / write_script work
 * unchanged. Surface ≠ storage; the wrapper is invisible to the
 * agent.
 */
export default function ScriptStudio() {
  return (
    <AgentProvider>
      <ScriptStudioInner />
    </AgentProvider>
  );
}

function ScriptStudioInner() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeBrand] = useActiveBrand();
  const [script, setScript] = useState<Script | null>(null);
  const {
    setOpen: setChatOpen,
    prefillInput,
    sendMessage,
    status: agentStatus,
  } = useAgent();

  // Load the Script from localStorage on mount + when the store
  // changes (e.g. another tab updated it). Re-runs when the URL id
  // changes so back-nav between scripts works cleanly.
  useEffect(() => {
    if (!id) return;
    const refresh = () => setScript(getScript(id));
    refresh();
    return subscribeScripts(refresh);
  }, [id]);

  // Brief + autosend handler — mirrors CoursesHome / CourseCanvas.
  // When CreateScriptPage submits, it navigates here with brief +
  // autosend=1; we open the chat, wait for the agent socket, fire
  // sendMessage, then clear the params so a back-nav doesn't replay.
  useEffect(() => {
    const brief = params.get("brief");
    const autosend = params.get("autosend") === "1";
    if (!brief) return;
    if (!script) return; // wait for script to load before sending the brief
    setChatOpen(true);
    if (autosend) {
      if (agentStatus !== "open") return; // wait for socket
      sendMessage(brief);
    } else {
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
  }, [
    params,
    script,
    agentStatus,
    setParams,
    setChatOpen,
    sendMessage,
    prefillInput,
  ]);

  /**
   * Synthetic Course wrapping the Script — gives MODE 3 (Synthesia
   * Scriptwriter) a course-shaped structure to navigate via
   * list_structure. The agent calls write_script(videoBlockId, text)
   * with videoBlockId === script.id; our writeScript handler routes
   * by id and saves to script.content.
   *
   * Surface and storage stay separate (script lives in scripts store);
   * the wrapper exists ONLY for the duration of an agent turn. The
   * agent never sees that this isn't a real course.
   */
  const syntheticCourse: Course | null = useMemo(() => {
    if (!script) return null;
    return {
      id: script.id,
      title: script.title,
      client: "",
      brand: activeBrand,
      modules: [
        {
          id: `m-${script.id}`,
          title: "Script",
          weekNumber: 1,
          lessons: [
            {
              id: `l-${script.id}`,
              title: "1.1 Video script",
              duration: 2,
              blocks: [
                {
                  id: script.id,
                  type: "video",
                  data: {
                    videoType: script.speakerMode,
                    script: script.content,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }, [script, activeBrand]);

  // writeScript handler — when the agent finishes a write_script tool
  // call, we route by id and persist to scripts.ts.
  const writeScriptHandler = useCallback(
    (videoBlockId: string, scriptContent: string) => {
      const current = id ? getScript(id) : null;
      if (!current || videoBlockId !== current.id) {
        return { ok: false, previousScriptLength: 0 };
      }
      const previousScriptLength = current.content.length;
      const updated: Script = {
        ...current,
        content: scriptContent,
        updatedAt: Date.now(),
      };
      saveScript(updated);
      setScript(updated);
      return { ok: true, previousScriptLength };
    },
    [id],
  );

  const updateTitle = useCallback(
    (title: string) => {
      if (!script) return;
      const updated: Script = { ...script, title, updatedAt: Date.now() };
      saveScript(updated);
      setScript(updated);
    },
    [script],
  );

  const updateContent = useCallback(
    (content: string) => {
      if (!script) return;
      const updated: Script = { ...script, content, updatedAt: Date.now() };
      saveScript(updated);
      setScript(updated);
    },
    [script],
  );

  // Minimal AgentActions registration — scripts only need writeScript +
  // getCourse (for list_structure). All other writer-mode actions
  // throw or no-op since you can't add modules / lessons / quizzes /
  // case studies to a standalone script. If the agent picks the wrong
  // mode (tries write_lesson on a script), the throw surfaces in the
  // chat so the LD sees what happened.
  const actions: AgentActions = useMemo(
    () => ({
      getCourse: () => syntheticCourse,
      navigate: () => {},
      setBrand: () => {},
      addModule: () => {
        throw new Error(
          "This is a standalone Synthesia script — modules can't be added here.",
        );
      },
      addLesson: () => {
        throw new Error(
          "This is a standalone Synthesia script — lessons can't be added here.",
        );
      },
      addBlock: () => {
        throw new Error(
          "This is a standalone Synthesia script — blocks can't be added here.",
        );
      },
      updateBlock: () => {},
      deleteBlock: () => {},
      reorder: () => {},
      exportLesson: () => {},
      writeLesson: () => {
        throw new Error(
          "This is a Synthesia script — call write_script, not write_lesson.",
        );
      },
      writeScript: writeScriptHandler,
      writeKnowledgeCheck: () => ({ ok: false, replaced: false }),
      regenerateQuestion: () => ({ ok: false }),
      designCaseStudy: () => ({ ok: false }),
    }),
    [syntheticCourse, writeScriptHandler],
  );
  useRegisterAgentActions(actions);

  if (!id) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <p className="text-sm text-ink-500">Missing script id.</p>
          <button
            onClick={() => navigate("/scripts/new")}
            className="btn-cta-primary mt-4"
          >
            Draft a new script
          </button>
        </div>
      </AppShell>
    );
  }

  if (!script) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <p className="text-sm text-ink-500">Script not found.</p>
          <Link to="/scripts/new" className="btn-cta-primary mt-4 inline-flex">
            Draft a new script
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Top bar — breadcrumb + Script Studio eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-ink-300">·</span>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-700 uppercase tracking-wider">
            <Mic size={11} /> Script Studio
          </div>
        </div>

        {/* Editable title */}
        <input
          value={script.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="w-full text-h1 text-ink-900 bg-transparent border-none outline-none mb-3 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus transition-all duration-base ease-sana tracking-[-0.01em]"
        />

        {/* Meta row — pulled from the form fields */}
        <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          {script.topic && (
            <>
              <span><strong className="text-ink-700">Topic:</strong> {script.topic}</span>
              <span className="text-ink-300">·</span>
            </>
          )}
          {script.audience && (
            <>
              <span><strong className="text-ink-700">For:</strong> {script.audience}</span>
              <span className="text-ink-300">·</span>
            </>
          )}
          <span><strong className="text-ink-700">Duration:</strong> {script.duration}</span>
          <span className="text-ink-300">·</span>
          <span><strong className="text-ink-700">Tone:</strong> {script.tone}</span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">Mode:</strong>{" "}
            {script.speakerMode === "speaker" ? "On-camera" : "Voice-over"}
          </span>
        </div>

        {/* Script content — scenes view (read-only structured) /
            raw view (editable textarea). Empty state explains the
            agent is drafting. */}
        <ScriptContent
          content={script.content}
          onChange={updateContent}
        />
      </div>

      {/* Studio Copilot chat — uses its own fixed-position panel CSS
          from B3-tune-b (right: 16, bottom: 16, top: 68, width: 340).
          Renders as a docked-right panel above the script editor. */}
      <AgentChat />
    </AppShell>
  );
}

// ─── Script content view ──────────────────────────────────────────────────────

interface Scene {
  index: number;
  spoken: string;
  visual: string;
}

/**
 * parseScenes — pulls SCENE / SPOKEN / VISUAL structure out of the
 * agent's script text. Mirrors the parser in CourseStudio.tsx
 * (BlockDrawer scene editor, #4g) so the same script content renders
 * the same scenes in either surface. Returns null on malformed text;
 * caller falls back to raw view.
 */
function parseScenes(text: string): Scene[] | null {
  if (!text.trim()) return null;
  if (!/SCENE\s+\d+/i.test(text)) return null;
  if (!/(SPOKEN|VISUAL):/i.test(text)) return null;
  const scenes: Scene[] = [];
  let current: Scene | null = null;
  let field: "spoken" | "visual" | null = null;
  for (const line of text.split("\n")) {
    const sceneMatch = line.match(/^\s*SCENE\s+(\d+)/i);
    if (sceneMatch) {
      if (current) scenes.push(current);
      current = { index: parseInt(sceneMatch[1], 10), spoken: "", visual: "" };
      field = null;
      continue;
    }
    if (!current) continue;
    const spokenMatch = line.match(/^\s*SPOKEN:\s*(.*)$/i);
    if (spokenMatch) {
      field = "spoken";
      current.spoken = spokenMatch[1];
      continue;
    }
    const visualMatch = line.match(/^\s*VISUAL:\s*(.*)$/i);
    if (visualMatch) {
      field = "visual";
      current.visual = visualMatch[1];
      continue;
    }
    if (field && line.trim()) {
      const sep = current[field] ? "\n" : "";
      current[field] = current[field] + sep + line.trim();
    }
  }
  if (current) scenes.push(current);
  return scenes;
}

function ScriptContent({
  content,
  onChange,
}: {
  content: string;
  onChange: (next: string) => void;
}) {
  const [view, setView] = useState<"scenes" | "raw">("scenes");
  const scenes = useMemo(() => (content ? parseScenes(content) : null), [content]);
  const effectiveView = scenes ? view : "raw";

  // Empty state — the script is a freshly-created Script with no
  // content yet (autosend is dispatching the brief; agent is on its
  // first turn). Once write_script lands, content fills in and the
  // scenes view renders.
  if (!content) {
    return (
      <div className="card p-10 text-center">
        <Mic className="mx-auto text-brand-500 mb-3" size={32} />
        <h3 className="text-h3 text-ink-900 mb-2">Studio Copilot is drafting your script…</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto">
          The SPOKEN / VISUAL scene structure will appear here once the
          agent finishes its first pass. Open the chat panel on the
          right to follow along or refine the angle.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {/* View toggle — only meaningful when scenes parse cleanly */}
      {scenes && (
        <div className="mb-4 flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
          {(["scenes", "raw"] as const).map((v) => {
            const active = effectiveView === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 h-7 rounded text-xs font-semibold capitalize transition ${
                  active
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {v === "scenes" ? "Scenes" : "Raw text"}
              </button>
            );
          })}
        </div>
      )}

      {effectiveView === "scenes" && scenes ? (
        <div className="space-y-1">
          {scenes.map((s) => (
            <div
              key={s.index}
              className="grid grid-cols-[68px_1fr_1fr] gap-5 items-start py-4 border-b border-ink-100 last:border-b-0"
            >
              <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mt-1">
                Scene {s.index}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                  Spoken
                </div>
                <div className="text-[13px] text-ink-900 whitespace-pre-wrap leading-relaxed">
                  {s.spoken || <em className="text-ink-300 not-italic">(empty)</em>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                  Visual
                </div>
                <div className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                  {s.visual || <em className="text-ink-300 not-italic">(empty)</em>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(20, content.split("\n").length + 2)}
          className="w-full font-mono text-xs text-ink-900 leading-relaxed bg-ink-50 border border-ink-200 rounded-md p-3 outline-none focus:border-brand-500 resize-y"
        />
      )}
    </div>
  );
}
