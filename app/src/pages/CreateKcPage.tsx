import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MaterialsDropZone } from "../shell/MaterialsDropZone";
import { useAgent } from "../agent/AgentContext";
import { saveKc } from "../store/kcs";

/**
 * Track-B-Quiz (KC Studio): standalone knowledge-check brief form.
 *
 * Mirrors CreateCoursePage's pattern but specific to KC generation:
 * topic + question count + Bloom's mix + question types + notes,
 * with the shared MaterialsDropZone for source-grounding.
 *
 * On submit:
 *   1. Generate kcId + syntheticLessonId.
 *   2. Save a stub Kc record to localStorage (empty questions).
 *   3. Migrate pendingMaterials onto a "course-shaped" structure
 *      KcStudio uses for read_materials grounding (the KC is a
 *      sibling artifact, not part of any course — but the agent's
 *      MODE 4 path expects a lesson context, hence the synthetic
 *      wrapper).
 *   4. Fire build_kc on the WS.
 *   5. Navigate to /kcs/:id where the result view lives.
 */
type DifficultyValue = "recall" | "apply" | "analyze";
type QuestionTypeValue = "mcq" | "short" | "scenario";

const QUESTION_COUNT_OPTIONS: { value: 3 | 5 | 10; label: string; hint: string }[] = [
  { value: 3, label: "3 questions", hint: "Quick check — 5 min" },
  { value: 5, label: "5 questions", hint: "Standard — 10 min" },
  { value: 10, label: "10 questions", hint: "Deep — 20 min" },
];

const DIFFICULTY_OPTIONS: { value: DifficultyValue; label: string; hint: string }[] = [
  { value: "recall", label: "Recall", hint: "Definitions, key facts" },
  { value: "apply", label: "Apply", hint: "Use the framework in a scenario" },
  { value: "analyze", label: "Analyze", hint: "Compare, evaluate, decide" },
];

const QUESTION_TYPE_OPTIONS: { value: QuestionTypeValue; label: string; hint: string }[] = [
  { value: "mcq", label: "Multiple choice", hint: "4 options, one correct" },
  { value: "short", label: "Short answer", hint: "1-2 sentence open response" },
  { value: "scenario", label: "Scenario MCQ", hint: "Situational stem + options" },
];

export default function CreateKcPage() {
  const navigate = useNavigate();
  const { sendBuildKc, pendingMaterials, clearPendingMaterials } = useAgent();

  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState<3 | 5 | 10>(5);
  const [difficultyMix, setDifficultyMix] = useState<DifficultyValue[]>([
    "recall",
    "apply",
    "analyze",
  ]);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeValue[]>(["mcq"]);
  const [notes, setNotes] = useState("");

  const topicValid = topic.trim().length > 0;
  const difficultyValid = difficultyMix.length > 0;
  const typesValid = questionTypes.length > 0;
  const isValid = topicValid && difficultyValid && typesValid;

  function toggleDifficulty(v: DifficultyValue) {
    setDifficultyMix((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }
  function toggleType(v: QuestionTypeValue) {
    setQuestionTypes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const kcId = "kc-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    // Track-B-Quiz: derive synthetic lesson id deterministically from
    // kcId so KcStudio's writeKnowledgeCheck handler validates the
    // agent's targetId against the SAME id without round-tripping
    // through localStorage. Mirrors deriveSyntheticLessonId in
    // KcStudio.tsx — keep both in sync if the format changes.
    const syntheticLessonId = `syn-lesson-${kcId}`;

    // Stub Kc record with empty questions. Materials migrate from
    // pendingMaterials so the agent can read them via the existing
    // bridge.read_materials flow. KcStudio result page renders the
    // questions when the agent's write_knowledge_check tool call
    // lands (FE-side actions resolve it onto this Kc).
    saveKc({
      id: kcId,
      title: topic.trim(),
      topic: topic.trim(),
      questionCount,
      difficultyMix,
      questionTypes,
      notes: notes.trim(),
      questions: [],
      costUsd: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Note: pendingMaterials are NOT migrated onto the Kc itself —
    // KcStudio resolves read_materials by reading them off the live
    // AgentContext slice (the same fallback path Course Architect
    // uses). They get cleared after the build completes via KcStudio's
    // own effect to keep them from leaking into a subsequent build.
    void clearPendingMaterials;

    sendBuildKc({
      kcId,
      topic: topic.trim(),
      syntheticLessonId,
      questionCount,
      difficultyMix,
      questionTypes,
      notes: notes.trim() || undefined,
    });

    navigate(`/kcs/${kcId}`);
  }

  // Hold pendingMaterials reference so we surface the count in the
  // form copy ("Building from your source: deck.pptx").
  const sourceLine =
    pendingMaterials.length > 0
      ? `Building from ${pendingMaterials.length} source${pendingMaterials.length === 1 ? "" : "s"}: ${pendingMaterials.map((m) => m.filename).join(", ")}`
      : null;

  return (
    <AppShell fullBleed>
      <div className="create-course-page">
        <div className="max-w-3xl mx-auto px-8 md:px-12 py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>

          <header className="section-header mb-12 animate-fade-up">
            <div>
              <h2 className="section-title">Build a knowledge check.</h2>
              <p className="section-sub">
                Drop a deck or doc, name a topic, and Studio Copilot drafts
                questions you can review, download, or paste into a course.
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-7 stagger-children">
            <FormField
              label="Topic"
              required
              hint="What do you want learners tested on? Be specific."
            >
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Reading the room before delivering hard news"
                className="form-input"
              />
            </FormField>

            <FormField
              label="Source materials"
              optional
              hint="Drop a deck, PDF, or Word doc. Questions will reference its frameworks and language."
            >
              <MaterialsDropZone hint="Drop the deck, PDF, or Word doc the KC should test understanding of" />
              {sourceLine && (
                <div className="mt-2 text-xs text-brand-700 italic">{sourceLine}</div>
              )}
            </FormField>

            <FormField label="How many questions?" required>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setQuestionCount(opt.value)}
                    className={
                      questionCount === opt.value ? "form-chip form-chip-active" : "form-chip"
                    }
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField
              label="Difficulty mix"
              required
              hint="Pick the Bloom's-levels you want represented across the set."
            >
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficultyMix.includes(opt.value);
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => toggleDifficulty(opt.value)}
                      className={active ? "form-chip form-chip-active" : "form-chip"}
                      title={opt.hint}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {!difficultyValid && (
                <div className="mt-2 text-xs text-red-600">
                  Pick at least one difficulty level.
                </div>
              )}
            </FormField>

            <FormField
              label="Question types"
              required
              hint="The agent will mix these across the set."
            >
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPE_OPTIONS.map((opt) => {
                  const active = questionTypes.includes(opt.value);
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => toggleType(opt.value)}
                      className={active ? "form-chip form-chip-active" : "form-chip"}
                      title={opt.hint}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {!typesValid && (
                <div className="mt-2 text-xs text-red-600">
                  Pick at least one question type.
                </div>
              )}
            </FormField>

            <FormField
              label="Notes for the agent"
              optional
              hint="Anything else? Specific concepts to emphasize, gotchas, audience-specific framing."
            >
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Lean toward scenarios that test stakeholder reading. Keep distractors plausible — these LDs are sharp."
                rows={3}
                className="form-textarea"
              />
            </FormField>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!isValid}
                className="btn-cta-primary"
              >
                Build knowledge check <ArrowRight size={14} strokeWidth={2.5} />
              </button>
              {!isValid && (
                <p className="text-caption text-ink-400 mt-2">
                  {!topicValid && "Topic is required. "}
                  {!difficultyValid && "Pick at least one difficulty. "}
                  {!typesValid && "Pick at least one question type. "}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function FormField({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-sm font-bold text-ink-900">{label}</span>
        {required && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
            Required
          </span>
        )}
        {optional && !required && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
            Optional
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-ink-500 mb-2">{hint}</div>}
      {children}
    </label>
  );
}
