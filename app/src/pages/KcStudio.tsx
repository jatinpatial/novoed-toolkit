import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Check, Download } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { AgentChat } from "../agent/AgentChat";
import { useAgent, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import { StudioBuildLoader } from "../shell/StudioBuildLoader";
import { getKc, saveKc, subscribeKcs, type Kc } from "../store/kcs";
import type { Course, QuizQuestion } from "../course/types";

const HTTP_URL = (import.meta.env.VITE_AGENT_HTTP_URL as string | undefined) ?? "http://127.0.0.1:8766";

/**
 * Track-B-Quiz / B3: KC Studio result view.
 *
 * Render path:
 *   - kcBuilds[kcId].status === "building" → centered loading state
 *     (orb + cycling phrases via AgentInflightIndicator)
 *   - kcBuilds[kcId].status === "done" + kc.questions populated →
 *     render the questions
 *   - kcBuilds[kcId].status === "failed" → friendly error with retry hint
 *   - kcBuilds[kcId] absent + kc.questions populated → already-built
 *     (rehydration / direct nav). Show questions + skip loading state.
 *
 * Synthetic course wrapper
 *   The agent's MODE 4 path expects a lesson context. KcStudio
 *   registers AgentActions that:
 *     - getCourse() → returns a 1-module / 1-lesson synthetic Course
 *       wrapping THIS Kc, with the lesson id matching the
 *       syntheticLessonId the brief form generated.
 *     - writeKnowledgeCheck() → updates Kc.questions in localStorage
 *       + React state. Same write path as Course Studio's KCs;
 *       kc-store-aware here.
 */
export default function KcStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { kcBuilds, status: agentStatus, clearPendingMaterials } = useAgent();

  const [kc, setKc] = useState<Kc | null>(null);
  const [triedLoad, setTriedLoad] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Load Kc by id from localStorage on mount + subscribe to changes
  // so the KC's questions appear when the agent's write_knowledge_check
  // action lands.
  useEffect(() => {
    if (!id) return;
    setKc(getKc(id));
    setTriedLoad(true);
    return subscribeKcs(() => setKc(getKc(id)));
  }, [id]);

  // KC clear-pendingMaterials once the build is done — keeps materials
  // from leaking into a subsequent build. Triggered on the "done"
  // transition specifically (not on every render with status=done).
  const buildState = id ? kcBuilds[id] : undefined;
  useEffect(() => {
    if (buildState?.status === "done") {
      clearPendingMaterials();
    }
  }, [buildState?.status, clearPendingMaterials]);

  // Synthetic Course wrapper — gives MODE 4 the lesson context it
  // expects. The synthetic lesson's id IS the syntheticLessonId the
  // brief generated; the agent's prompt references it; FE-side
  // writeKnowledgeCheck below resolves against it.
  const syntheticCourse: Course | null = useMemo(() => {
    if (!kc) return null;
    return {
      id: `syn-course-${kc.id}`,
      title: kc.title || kc.topic,
      client: "",
      brand: "bcgu",
      modules: [
        {
          id: `syn-mod-${kc.id}`,
          title: kc.topic,
          weekNumber: 1,
          summary: kc.notes || "",
          objectives: [],
          lessons: [
            {
              id: deriveSyntheticLessonId(kc.id),
              title: kc.topic,
              duration: 10,
              blocks: [],
              objectives: [],
              knowledgeCheck: kc.questions.length > 0 ? { questions: kc.questions } : undefined,
            },
          ],
        },
      ],
    };
  }, [kc]);

  // AgentActions: getCourse returns the synthetic course;
  // writeKnowledgeCheck updates the Kc's questions in localStorage.
  // Other actions throw with helpful errors so unexpected tool calls
  // surface a clear message rather than silently mutating something.
  const actions: AgentActions = useMemo(
    () => ({
      getCourse: () => syntheticCourse,
      navigate: (route) => {
        navigate(route);
      },
      setBrand: () => {},
      addModule: () => {
        throw new Error("KC Studio: this is a standalone knowledge check — add_module isn't supported.");
      },
      addLesson: () => {
        throw new Error("KC Studio: this is a standalone knowledge check — add_lesson isn't supported.");
      },
      addBlock: () => {
        throw new Error("KC Studio: standalone knowledge check — add_block isn't supported.");
      },
      updateBlock: () => {
        throw new Error("KC Studio: standalone knowledge check — updateBlock isn't supported.");
      },
      deleteBlock: () => {
        throw new Error("KC Studio: standalone knowledge check — deleteBlock isn't supported.");
      },
      reorder: () => {},
      exportLesson: () => {},
      writeLesson: () => {
        throw new Error("KC Studio: write_lesson isn't supported here — call write_knowledge_check.");
      },
      writeScript: () => {
        throw new Error("KC Studio: write_script isn't supported here.");
      },
      writeKnowledgeCheck: (targetKind, targetId, questions) => {
        if (!kc) return { ok: false, replaced: false };
        // Validate the agent's targetId matches our synthetic lesson.
        // Bridge UUIDs are global; if the agent calls with a stale id
        // we want to surface the mismatch rather than silently no-op.
        const expectedLessonId = deriveSyntheticLessonId(kc.id);
        if (targetKind !== "lesson" || targetId !== expectedLessonId) {
          console.warn(
            "[kc-studio] writeKnowledgeCheck: targetKind=%s targetId=%s doesn't match synthetic lesson %s",
            targetKind,
            targetId,
            expectedLessonId,
          );
          return { ok: false, replaced: false };
        }
        const replaced = kc.questions.length > 0;
        const next: Kc = { ...kc, questions, updatedAt: Date.now() };
        saveKc(next);
        setKc(next);
        return { ok: true, replaced };
      },
      regenerateQuestion: (targetKind, targetId, questionIndex, question) => {
        if (!kc) return { ok: false };
        if (questionIndex < 0 || questionIndex >= kc.questions.length) {
          return { ok: false };
        }
        const nextQuestions = [...kc.questions];
        nextQuestions[questionIndex] = question;
        const next: Kc = { ...kc, questions: nextQuestions, updatedAt: Date.now() };
        saveKc(next);
        setKc(next);
        void targetKind;
        void targetId;
        return { ok: true };
      },
      designCaseStudy: () => {
        throw new Error("KC Studio: design_case_study isn't supported here.");
      },
    }),
    [kc, syntheticCourse, navigate],
  );
  useRegisterAgentActions(actions);

  function updateTitle(newTitle: string) {
    if (!kc) return;
    const next: Kc = { ...kc, title: newTitle, updatedAt: Date.now() };
    saveKc(next);
    setKc(next);
  }

  async function downloadDocx() {
    if (!kc) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await fetch(`${HTTP_URL}/export/kc-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: kc.title,
          topic: kc.topic,
          questions: kc.questions,
          brand: "bcgu",
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
      const stem = (kc.title || kc.topic || "kc").replace(/[^\w\-_.]/g, "_");
      a.download = `${stem}-kc.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  // Loading guard — kc not yet loaded from localStorage on first
  // mount.
  if (!kc && triedLoad) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 px-6 text-center">
          <Brain size={32} className="mx-auto text-ink-400 mb-3" />
          <h2 className="text-h2 text-ink-900 mb-2">Knowledge check not found</h2>
          <p className="text-sm text-ink-500 mb-6">
            This KC may have been deleted or never finished saving.
          </p>
          <Link to="/" className="btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }
  if (!kc) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 px-6 text-center text-sm text-ink-500">
          Loading…
        </div>
      </AppShell>
    );
  }

  const isBuilding = buildState?.status === "building";
  const isFailed = buildState?.status === "failed";
  const hasQuestions = kc.questions.length > 0;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-ink-300">·</span>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-700 uppercase tracking-wider">
            <Brain size={11} /> KC Studio
          </div>
        </div>

        {/* Editable title */}
        <input
          value={kc.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="w-full text-h1 text-ink-900 bg-transparent border-none outline-none mb-3 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus transition-all duration-base ease-sana tracking-[-0.01em]"
        />

        {/* Meta + download */}
        <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span>
            <strong className="text-ink-700">Topic:</strong> {kc.topic}
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">{kc.questionCount} Q</strong>
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">Difficulty:</strong>{" "}
            {kc.difficultyMix.length > 0 ? kc.difficultyMix.join(" + ") : "Mixed"}
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">Types:</strong>{" "}
            {kc.questionTypes.join(" + ")}
          </span>
        </div>

        {/* Body — building / failed / questions */}
        {isBuilding && (
          <StudioBuildLoader
            heading="Studio Copilot is writing your questions…"
            subhead="Reading source materials, calibrating difficulty, drafting plausible distractors. Usually 60-90 seconds."
            phrases={[
              "Reading the source",
              "Picking the concepts",
              "Drafting the stems",
              "Crafting questions that stick",
              "Calibrating difficulty",
              "Writing distractors that tempt",
              "Adding rationales",
              "Tightening the wording",
            ]}
            estimateMs={75_000}
          />
        )}

        {isFailed && (
          <div className="card p-8 border-red-200 bg-red-50">
            <h3 className="text-h3 text-ink-900 mb-2">Build failed</h3>
            <p className="text-sm text-ink-700 mb-2">
              {buildState?.status === "failed" ? buildState.error : "Unknown error"}
            </p>
            <p className="text-xs text-ink-500">
              The build can be retried by going back to{" "}
              <Link to="/kcs/new" className="text-brand-700 underline">
                KC Studio
              </Link>{" "}
              and submitting again with the same inputs. The Kc record stays so
              your form values are preserved.
            </p>
          </div>
        )}

        {!isBuilding && !isFailed && hasQuestions && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-h3 text-ink-900">{kc.questions.length} question{kc.questions.length === 1 ? "" : "s"}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadDocx}
                  disabled={downloading}
                  className="btn-secondary btn-sm"
                >
                  <Download size={14} /> {downloading ? "Downloading…" : "Download .docx"}
                </button>
              </div>
            </div>
            {downloadError && (
              <div className="mb-4 text-xs text-red-600">
                Download failed: {downloadError}
              </div>
            )}
            <div className="space-y-6">
              {kc.questions.map((q, i) => (
                <QuestionCard key={i} index={i + 1} q={q} />
              ))}
            </div>
          </>
        )}

        {!isBuilding && !isFailed && !hasQuestions && (
          <div className="card p-8 text-center">
            <Brain size={32} className="mx-auto text-ink-400 mb-3" />
            <h3 className="text-h3 text-ink-900 mb-2">No questions yet</h3>
            <p className="text-sm text-ink-500 mb-4">
              The build hasn't finished or never started. Try{" "}
              <Link to="/kcs/new" className="text-brand-700 underline">
                creating a fresh KC
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {agentStatus && <AgentChat />}
    </AppShell>
  );
}

function QuestionCard({ index, q }: { index: number; q: QuizQuestion }) {
  const typeLabel = q.type === "mcq" ? "MCQ" : "Short answer";
  return (
    <div className="card p-6">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
          Q{index}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {typeLabel}
        </span>
      </div>
      <div className="text-base text-ink-900 mb-4 leading-relaxed">{q.stem}</div>
      {q.type === "mcq" && q.options && (
        <div className="space-y-2 mb-4">
          {q.options.map((opt, oi) => {
            const correct = oi === q.correctIndex;
            return (
              <div
                key={oi}
                className={`flex items-start gap-2 px-3 py-2 rounded-md border ${
                  correct
                    ? "border-brand-300 bg-brand-50"
                    : "border-ink-200 bg-white"
                }`}
              >
                <span
                  className={`text-xs font-bold flex-shrink-0 mt-0.5 ${
                    correct ? "text-brand-700" : "text-ink-500"
                  }`}
                >
                  {correct ? <Check size={14} /> : String.fromCharCode(65 + oi)}
                </span>
                <span
                  className={`text-sm flex-1 ${
                    correct ? "font-semibold text-ink-900" : "text-ink-700"
                  }`}
                >
                  {opt}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {q.type === "short" && q.expectedAnswerHints && q.expectedAnswerHints.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
            Expected answer hints (rubric)
          </div>
          <ul className="space-y-1">
            {q.expectedAnswerHints.map((h, hi) => (
              <li key={hi} className="text-sm text-ink-700 flex items-start gap-2">
                <span className="text-brand-600 flex-shrink-0">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.type === "mcq" && q.rationale && (
        <div className="text-xs italic text-ink-500 leading-relaxed border-t border-ink-100 pt-3">
          <strong className="not-italic font-semibold text-ink-700">
            Rationale:
          </strong>{" "}
          {q.rationale}
        </div>
      )}
    </div>
  );
}

/**
 * Track-B-Quiz: derive the synthetic-lesson id deterministically from
 * the kcId so the brief form (CreateKcPage) and KcStudio agree on
 * which id the agent should use without round-tripping it through
 * localStorage. Brief form passes this same value as
 * syntheticLessonId in the build_kc payload; KcStudio reads it back
 * to validate the agent's writeKnowledgeCheck target.
 */
function deriveSyntheticLessonId(kcId: string): string {
  return `syn-lesson-${kcId}`;
}
