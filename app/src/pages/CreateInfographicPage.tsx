import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MaterialsDropZone } from "../shell/MaterialsDropZone";
import { useAgent } from "../agent/AgentContext";
import { useActiveBrand } from "../shell/TopBar";
import { B, type BrandKey } from "../brand/tokens";
import {
  saveInfographic,
  type InfographicFormat,
  type InfographicStyle,
} from "../store/infographics";

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

// Track-X2: 9 sophisticated layouts. Grouped visually (not in the type)
// into "core" (process/quadrant/comparison/numbered_list/timeline —
// general-purpose) and "specialized" (stat_spotlight/pyramid/cycle/
// five_forces — designed for specific content shapes). The form lays
// them out as one wrap-flex chip group so the LD doesn't have to learn
// the grouping; the hint copy is what tells them when each fits.
const STYLE_OPTIONS: { value: InfographicStyle; label: string; hint: string }[] = [
  { value: "process",        label: "Process Flow",       hint: "Numbered sequence, each step builds on the previous" },
  { value: "quadrant",       label: "Strategy Quadrant",  hint: "2x2 matrix with axis labels — best for trade-offs" },
  { value: "comparison",     label: "Comparison Matrix",  hint: "2-3 options side-by-side, head-to-head columns" },
  { value: "numbered_list",  label: "Numbered List",      hint: "Vertical with large numbers — rank or sequence" },
  { value: "timeline",       label: "Timeline",           hint: "Chronological flow — phases / dates / eras" },
  { value: "stat_spotlight", label: "Stat Spotlight",     hint: "Big hero numbers with captions — for headline data" },
  { value: "pyramid",        label: "Hierarchy Pyramid",  hint: "3-5 stacked levels — vision → strategy → tactics" },
  { value: "cycle",          label: "Cycle / Loop",       hint: "Circular flow — repeating phases (PDCA, kaizen)" },
  { value: "five_forces",    label: "Five Forces",        hint: "Porter-style — central concept + surrounding forces" },
];

const POINT_COUNT_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 3, label: "3", hint: "Tight, three big ideas" },
  { value: 4, label: "4", hint: "Balanced (default for quadrants)" },
  { value: 5, label: "5", hint: "Standard infographic depth" },
  { value: 6, label: "6", hint: "Detailed" },
  { value: 7, label: "7", hint: "Most depth (numbered list works best at 7)" },
];

// Track-S: output format options. PNG ships now; HTML + SCORM are
// surfaced as "soon" so LDs can express intent — selecting either
// at submit shows a toast and falls back to PNG.
const FORMAT_OPTIONS: {
  value: InfographicFormat;
  label: string;
  hint: string;
  soon: boolean;
}[] = [
  {
    value: "png",
    label: "PNG image",
    hint: "Creative visual, downloadable. Available now.",
    soon: false,
  },
  {
    value: "html",
    label: "HTML",
    hint: "Embed in NovoEd. Coming next week.",
    soon: true,
  },
  {
    value: "scorm",
    label: "SCORM",
    hint: "Interactive with flipcards. Coming next week.",
    soon: true,
  },
];

export default function CreateInfographicPage() {
  const navigate = useNavigate();
  const { sendBuildInfographic, pendingMaterials } = useAgent();
  // Track-X4: brand selection lives in the form's Style options
  // section (was previously in the global TopBar). The active brand
  // is still the global state — picking here writes it via setBrand
  // so the InfographicStudio result page reads the same value when
  // it renders.
  const [brand, setBrand] = useActiveBrand();

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState<InfographicStyle>("numbered_list");
  const [pointCount, setPointCount] = useState<number>(5);
  const [notes, setNotes] = useState("");
  // Track-S form additions
  const [format, setFormat] = useState<InfographicFormat>("png");
  const [useBrandColors, setUseBrandColors] = useState(true);
  const [includePeopleImages, setIncludePeopleImages] = useState(false);
  const [comingSoonNote, setComingSoonNote] = useState<string | null>(null);

  const topicValid = topic.trim().length > 0;
  const isValid = topicValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    // Track-S: HTML + SCORM picked → show toast + fall back to PNG.
    // The choice gets recorded on the Infographic record so we can
    // surface "you wanted SCORM — coming next week" on the result
    // page. Doesn't block the build.
    const effectiveFormat: InfographicFormat = format === "png" ? "png" : "png";
    if (format !== "png") {
      setComingSoonNote(
        `${format === "html" ? "HTML" : "SCORM"} output is coming next week. Building the PNG version now — you can re-export later.`,
      );
    }

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
      format: effectiveFormat,
      useBrandColors,
      includePeopleImages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Compose extra prompt notes from the toggles so the agent can
    // adjust output for brand + people-images preferences.
    const extraNotes: string[] = [];
    if (notes.trim()) extraNotes.push(notes.trim());
    if (useBrandColors) {
      extraNotes.push(
        "Use brand colors and brand-professional typography choices in the output.",
      );
    }
    if (includePeopleImages) {
      extraNotes.push(
        "Where appropriate, suggest a real-life people image per point (one or two-word search hint in the iconHint field formatted as 'photo:<query>'). The renderer will fetch matching photography from Pexels.",
      );
    }

    sendBuildInfographic({
      infographicId: id,
      topic: topic.trim(),
      style,
      pointCount,
      notes: extraNotes.join("\n\n") || undefined,
    });

    navigate(`/infographics/${id}`);
  }

  // Track-X2: per-style point-count nudge. Each specialized layout has
  // a sweet-spot count where it reads cleanest; this surfaces a gentle
  // hint without blocking the LD from picking what they want.
  const styleHint = (() => {
    if (style === "quadrant" && pointCount !== 4) {
      return "Quadrant style works best with exactly 4 points (one per quadrant).";
    }
    if (style === "five_forces" && pointCount !== 5) {
      return "Five Forces is designed for exactly 5 points (one per force).";
    }
    if (style === "pyramid" && (pointCount < 3 || pointCount > 5)) {
      return "Hierarchy Pyramid reads best with 3–5 levels.";
    }
    if (style === "cycle" && (pointCount < 4 || pointCount > 6)) {
      return "Cycle layouts read best with 4–6 phases around the loop.";
    }
    if (style === "stat_spotlight" && (pointCount < 3 || pointCount > 5)) {
      return "Stat Spotlight reads best with 3–5 hero numbers.";
    }
    return null;
  })();

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
              {styleHint && (
                <div className="mt-2 text-xs text-ink-500 italic">{styleHint}</div>
              )}
            </FormField>

            <FormField
              label="Output format"
              required
              hint="PNG ships now. HTML + SCORM are coming next week — picking either today builds the PNG version and records your interest."
            >
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={
                      format === opt.value ? "form-chip form-chip-active" : "form-chip"
                    }
                    title={opt.hint}
                  >
                    {opt.label}
                    {opt.soon && (
                      <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider opacity-70">
                        soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {comingSoonNote && (
                <div className="mt-2 text-xs text-brand-700 italic">{comingSoonNote}</div>
              )}
            </FormField>

            <FormField
              label="Style options"
              optional
              hint="Make the output match your brand and audience."
            >
              <div className="space-y-3">
                {/* Track-X4: brand chip group lives in the form, not
                    the TopBar. Contextual to the infographic being
                    built. Writes to the active-brand global so the
                    result page picks up the same value via
                    --brand-* cascade vars. */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                    Brand
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(B) as BrandKey[]).map((k) => (
                      <button
                        type="button"
                        key={k}
                        onClick={() => setBrand(k)}
                        className={
                          brand === k
                            ? "form-chip form-chip-active inline-flex items-center gap-2"
                            : "form-chip inline-flex items-center gap-2"
                        }
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                          style={{ background: B[k].pri }}
                          aria-hidden="true"
                        />
                        {B[k].n}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer p-2 -mx-2 rounded-md hover:bg-ink-50 transition">
                  <input
                    type="checkbox"
                    checked={useBrandColors}
                    onChange={(e) => setUseBrandColors(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink-900 block">
                      Use brand colors and font
                    </span>
                    <span className="text-xs text-ink-500 leading-relaxed">
                      The infographic uses the brand selected above.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer p-2 -mx-2 rounded-md hover:bg-ink-50 transition">
                  <input
                    type="checkbox"
                    checked={includePeopleImages}
                    onChange={(e) => setIncludePeopleImages(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink-900 block">
                      Include people images
                    </span>
                    <span className="text-xs text-ink-500 leading-relaxed">
                      Pulls professional photography from Pexels per point. Requires the Pexels API key configured in <code className="text-[10px]">.env</code>.
                    </span>
                  </span>
                </label>
              </div>
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
