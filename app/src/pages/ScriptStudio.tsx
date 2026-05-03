import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Mic, Sparkles } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import {
  AgentProvider,
  useAgent,
  useRegisterAgentActions,
  type AgentActions,
} from "../agent/AgentContext";
import { AgentChat, AgentInflightIndicator } from "../agent/AgentChat";
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
/**
 * ScriptStudioBoundary — error boundary wrapping the page so a render
 * exception inside ScriptStudioInner / AgentProvider / AgentChat
 * doesn't blank the screen (polish-5b). Logs to console for diagnosis,
 * shows a recover-friendly fallback. Without this, a thrown error
 * during the autosend handshake or syntheticCourse construction
 * left the page completely white in live testing.
 */
class ScriptStudioBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the browser console so the user can paste the trace
    // for diagnosis. Plain console.error so the React DevTools error
    // overlay still surfaces too.
    // eslint-disable-next-line no-console
    console.error("[ScriptStudio] Render exception:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-3xl mx-auto py-12 text-center px-6">
          <p className="text-sm font-bold text-ink-900 mb-2">
            Script Studio hit a render error.
          </p>
          <p className="text-xs text-ink-500 mb-4">
            Open the browser console (F12) for the stack trace, then
            head back to the dashboard.
          </p>
          <pre className="text-[11px] text-ink-600 bg-ink-50 border border-ink-200 rounded p-3 text-left overflow-auto mb-4">
            {String(this.state.error.message || this.state.error)}
          </pre>
          <Link to="/" className="btn-cta-primary inline-flex">
            Back to dashboard
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ScriptStudio() {
  return (
    <ScriptStudioBoundary>
      <AgentProvider>
        <ScriptStudioInner />
      </AgentProvider>
    </ScriptStudioBoundary>
  );
}

function ScriptStudioInner() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeBrand] = useActiveBrand();
  const [script, setScript] = useState<Script | null>(null);
  // polish-5b: triedLoad gate handles the "script saved -> navigate ->
  // mount -> first render BEFORE useEffect fires" micro-window where
  // script would be null and we'd flash "Script not found." Setting
  // triedLoad inside the effect ensures we render the loading state
  // until the load actually completes (success or null).
  const [triedLoad, setTriedLoad] = useState(false);
  // loadAttempt — three retries at 100ms each to handle the
  // localStorage propagation race in case the saveScript -> navigate
  // -> mount sequence is somehow split across event-loop ticks.
  const [loadAttempt, setLoadAttempt] = useState(0);
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
    const refresh = () => {
      const s = getScript(id);
      setScript(s);
      setTriedLoad(true);
      if (!s && loadAttempt < 3) {
        // polish-5b: schedule a retry in case the localStorage write
        // hadn't propagated yet (rare but seen in live testing).
        setTimeout(() => setLoadAttempt((a) => a + 1), 100);
      }
    };
    refresh();
    return subscribeScripts(refresh);
  }, [id, loadAttempt]);

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

  // polish-5b: loading vs. not-found split. Pre-fix, any null script
  // rendered "Script not found." — including the micro-window between
  // mount and the useEffect firing, AND during the localStorage
  // propagation race. Now: while triedLoad is false OR we still have
  // retries left, show a loading state. Only show "not found" once
  // we've genuinely tried + retried + still got null.
  const isStillLoading = !script && (!triedLoad || loadAttempt < 3);
  if (isStillLoading) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <Mic className="mx-auto text-brand-500 mb-3 animate-pulse" size={28} />
          <p className="text-sm text-ink-500">Opening script…</p>
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
            transcript view (cleaned, readonly, downloadable). Empty
            state explains the agent is drafting. polish-6e: raw view
            renamed to transcript, control tags stripped, download
            button surfaced, "Ready to add to Synthesia" callout
            above. */}
        <ScriptContent
          content={script.content}
          title={script.title}
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
  title,
  onChange,
}: {
  content: string;
  title: string;
  onChange: (next: string) => void;
}) {
  const [view, setView] = useState<"scenes" | "transcript">("scenes");
  const scenes = useMemo(() => (content ? parseScenes(content) : null), [content]);
  const effectiveView = scenes ? view : "transcript";

  // polish-6e: produce a cleaned transcript with Synthesia control
  // tags stripped — what the LD pastes into Synthesia is the prose,
  // not the timing markup. The original content (with tags) stays
  // in the underlying script string; this is display-only.
  const transcript = useMemo(() => stripSynthesiaControlTags(content), [content]);

  // polish-6e: download the cleaned transcript as a .txt file with
  // a filename derived from the script title. Filename sanitization
  // matches the script-docx download pattern in CourseStudio.
  function downloadTranscript() {
    const stem = (title || "script-transcript").replace(/[^\w\-_.]/g, "_");
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stem}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Empty state — the script is a freshly-created Script with no
  // content yet (autosend is dispatching the brief; agent is on its
  // first turn). Once write_script lands, content fills in and the
  // scenes view renders.
  //
  // polish-5c: shows the AgentInflightIndicator card when the agent
  // is working — same visual + cycling phrases as the in-message
  // indicator in the chat panel. When the agent isn't thinking
  // (no autosend in flight, manual draft state), shows the static
  // "draft your script" prompt. AgentInflightIndicator returns
  // null when not thinking so this composition is robust.
  if (!content) {
    return (
      <div className="card p-10 text-center">
        <Mic className="mx-auto text-brand-500 mb-3" size={32} />
        <h3 className="text-h3 text-ink-900 mb-2">Studio Copilot is drafting your script…</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto mb-4">
          The SPOKEN / VISUAL scene structure will appear here once the
          agent finishes its first pass. Open the chat panel on the
          right to follow along or refine the angle.
        </p>
        <div className="agent-inflight-card-wrap">
          <AgentInflightIndicator centered />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {/* View toggle — only meaningful when scenes parse cleanly.
          polish-6e: Raw → Transcript label change, Download button
          surfaces in transcript view. */}
      {scenes && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-100 w-fit">
            {(["scenes", "transcript"] as const).map((v) => {
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
                  {v === "scenes" ? "Scenes" : "Transcript"}
                </button>
              );
            })}
          </div>
          {effectiveView === "transcript" && transcript && (
            <button
              onClick={downloadTranscript}
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-semibold text-brand-700 hover:text-white hover:bg-brand-600 border border-brand-200 hover:border-brand-600 transition"
              title="Download transcript as .txt"
            >
              <Download size={12} /> Download .txt
            </button>
          )}
        </div>
      )}

      {/* polish-6e: "Ready to add to Synthesia" callout banner above
          the transcript view. Brand-tinted, minimal — frames the
          export step for the LD. Hidden on the scenes view since
          that's the working surface, not the export surface. */}
      {effectiveView === "transcript" && transcript && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand-50 border border-brand-200 text-xs text-brand-800">
          <Sparkles size={14} className="text-brand-600 flex-shrink-0" />
          <span>
            <strong className="font-semibold">Ready to add to Synthesia.</strong>{" "}
            Control tags stripped — paste this transcript directly.
          </span>
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
        /* polish-6e: transcript view shows the cleaned export-ready
           text. Readonly because edits to the cleaned version would
           be destructive of the underlying control tags (timing
           markers needed in Synthesia). To edit the script, use the
           agent ("regenerate scene 3 with shorter narration") — that
           preserves tags. */
        <textarea
          value={transcript}
          readOnly
          rows={Math.max(20, transcript.split("\n").length + 2)}
          className="w-full font-mono text-xs text-ink-900 leading-relaxed bg-ink-50 border border-ink-200 rounded-md p-3 outline-none resize-y"
        />
      )}
    </div>
  );
}

/**
 * polish-6e: strip Synthesia control tags from script content for
 * the transcript view + .txt download.
 *
 * Synthesia uses inline tags for pacing and audio direction:
 *   <break time="1.5s"/>   <break time="500ms"/>
 *   <breaktime="1s"/>      (mistyped variant from older drafts)
 *   <pause/>               <pause time="2s"/>
 *   <emphasis level="strong">…</emphasis>
 *
 * The transcript is for sharing / pasting — strip all <…/> tags and
 * collapse whitespace runs back to single spaces. Keep paragraph
 * breaks (\n\n stays as \n\n).
 */
function stripSynthesiaControlTags(content: string): string {
  if (!content) return "";
  return (
    content
      // Self-closing tags: <break .../> <pause/> etc.
      .replace(/<\s*\/?[a-zA-Z]+(?:\s[^>]*?)?\/?\s*>/g, "")
      // Collapse runs of spaces but preserve paragraph breaks.
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
      .join("\n")
      // Collapse 3+ consecutive newlines down to 2 (paragraph break).
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
