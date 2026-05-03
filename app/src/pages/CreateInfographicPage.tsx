import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MaterialsDropZone } from "../shell/MaterialsDropZone";
import { useAgent } from "../agent/AgentContext";
import { saveInfographic, type InfographicStyle } from "../store/infographics";

/**
 * Track-G / G2: Infographic Studio brief form.
 *
 * Same architectural pattern as CreateKcPage:
 *   1. Generate infographicId.
 *   2. saveInfographic() with empty points[] + form values preserved.
 *   3. sendBuildInfographic() — fires build_infographic on the WS,
 *      sets infographicBuilds[id] = { status: "building" }
 *      optimistically.
 *   4. navigate(`/infographics/${id}`) — InfographicStudio takes over.
 */

const STYLE_OPTIONS: { value: InfographicStyle; label: string; hint: string }[] = [
  { value: "process", label: "Process", hint: "Numbered sequence, each step builds" },
  { value: "quadrant", label: "Quadrant", hint: "2x2 matrix with axis labels" },
  { value: "comparison", label: "Comparison", hint: "2-3 columns side-by-side" },
  { value: "numbered_list", label: "Numbered list", hint: "Vertical with large numbers" },
  { value: "timeline", label: "Timeline", hint: "Chronological flow" },
];

const POINT_COUNT_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 3, label: "3", hint: "Tight, three big ideas" },
  { value: 4, label: "4", hint: "Balanced (default for quadrants)" },
  { value: 5, label: "5", hint: "Standard infographic depth" },
  { value: 6, label: "6", hint: "Detailed" },
  { value: 7, label: "7", hint: "Most depth (numbered list works best at 7)" },
];

export default function CreateInfographicPage() {
  const navigate = useNavigate();
  const { sendBuildInfographic, pendingMaterials } = useAgent();

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<InfographicStyle>("numbered_list");
  const [pointCount, setPointCount] = useState<number>(5);
  const [notes, setNotes] = useState("");

  const topicValid = topic.trim().length > 0;
  const isValid = topicValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const id =
      "ig-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

    saveInfographic({
      id,
      title: topic.trim(),
      topic: topic.trim(),
      style,
      pointCount,
      notes: notes.trim(),
      subtitle: "",
      points: [],
      costUsd: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    sendBuildInfographic({
      infographicId: id,
      topic: topic.trim(),
      style,
      pointCount,
      notes: notes.trim() || undefined,
    });

    navigate(`/infographics/${id}`);
  }

  // Quadrant style works best with exactly 4 points; gently nudge.
  const quadrantHint =
    style === "quadrant" && pointCount !== 4
      ? "Quadrant style works best with exactly 4 points (one per quadrant)."
      : null;

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
              <h2 className="section-title">Build an infographic.</h2>
              <p className="section-sub">
                Drop a deck or doc, name a topic, pick a layout. Studio Copilot
                composes a structured visual you can download as a PNG.
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-7 stagger-children">
            <FormField
              label="Title"
              required
              hint="What does this infographic communicate?"
            >
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Five reactions to difficult feedback"
                className="form-input"
              />
            </FormField>

            <FormField
              label="Source materials"
              optional
              hint="Drop a deck, PDF, or Word doc. Points will reference its frameworks and language."
            >
              <MaterialsDropZone hint="Drop the deck, PDF, or Word doc the infographic should ground in" />
              {sourceLine && (
                <div className="mt-2 text-xs text-brand-700 italic">{sourceLine}</div>
              )}
            </FormField>

            <FormField label="Style" required>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setStyle(opt.value)}
                    className={style === opt.value ? "form-chip form-chip-active" : "form-chip"}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Number of points" required>
              <div className="flex flex-wrap gap-2">
                {POINT_COUNT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPointCount(opt.value)}
                    className={
                      pointCount === opt.value ? "form-chip form-chip-active" : "form-chip"
                    }
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {quadrantHint && (
                <div className="mt-2 text-xs text-ink-500 italic">{quadrantHint}</div>
              )}
            </FormField>

            <FormField label="Notes for the agent" optional>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Skew toward 'apply' framing — these are practitioners, not students."
                rows={3}
                className="form-textarea"
              />
            </FormField>

            <div className="pt-2">
              <button type="submit" disabled={!isValid} className="btn-cta-primary">
                Build infographic <ArrowRight size={14} strokeWidth={2.5} />
              </button>
              {!isValid && (
                <p className="text-caption text-ink-400 mt-2">Title is required.</p>
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
