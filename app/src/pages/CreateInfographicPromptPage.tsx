import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { useAgent } from "../agent/AgentContext";
import { useActiveBrand } from "../shell/TopBar";
import { B, type BrandKey } from "../brand/tokens";
import {
  saveInfographic,
  type InfographicStyle,
} from "../store/infographics";

/**
 * Track-SS (Deckster-style): Quick Prompt Infographic.
 *
 * Counterpart to CreateInfographicPage. The detailed brief asks for
 * style / point count / format / notes. This page asks for ONE thing:
 * a sentence describing the infographic. We auto-pick the layout and
 * point count from the prompt and ship it straight to the build.
 *
 * Inspired by Deckster ("type a sentence, get a slide"). The
 * differentiator: this surface feels AI-native — no form to fill,
 * just describe and go. The detailed brief stays available for LDs
 * who want surgical control.
 *
 * Architecture notes:
 *   - Same store + agent endpoint as CreateInfographicPage. The
 *     agent's MODE 6 already infers content from `topic` + `notes`;
 *     all this page does is pre-pick the structural fields the agent
 *     would otherwise read off the form.
 *   - The "auto-detected" layout is a CLIENT-SIDE heuristic (regex
 *     against the prompt). It's a hint, not a contract — the notes
 *     field tells the agent it can override if a different layout
 *     fits better. Belt + suspenders.
 *   - Examples chip row populates the textarea on click. Not just
 *     decoration: the chips ARE the docs for what this surface does.
 */

interface InferenceResult {
  style: InfographicStyle;
  pointCount: number;
  reason: string;
}

/**
 * Pattern-match the prompt to infer layout + point count.
 *
 * Order matters: we test the most specific phrasings first
 * (e.g. "five forces" before generic "5 things"). The regex layer
 * catches obvious cases; the catch-all returns numbered_list with 5
 * points, which the agent can override via the notes field.
 *
 * Why client-side rather than asking the agent: the form already
 * has `style` and `pointCount` as required fields. Hitting the
 * agent twice (once to classify, once to build) doubles the
 * latency for what's a 90%-accurate regex match. If misclassified,
 * the user can re-run with the detailed brief.
 */
function inferStyleAndCount(prompt: string): InferenceResult {
  const t = prompt.toLowerCase();

  // ─── Specific layouts ──
  if (/\b(five[\s-]?forces|porter['']s)\b/.test(t)) {
    return { style: "five_forces", pointCount: 5, reason: "Porter-style five forces detected" };
  }
  if (/\b(2[\s-]?x[\s-]?2|quadrant|matrix\b|trade[\s-]?offs?)\b/.test(t)) {
    return { style: "quadrant", pointCount: 4, reason: "2x2 / matrix layout detected" };
  }
  if (/\b(timeline|chronolog|history of|evolution of|over the years|by year|from \d{4})\b/.test(t)) {
    return { style: "timeline", pointCount: 5, reason: "Timeline / chronology detected" };
  }
  if (/\b(cycle|loop|continuous|pdca|kaizen|iterat|circular|repeat)/.test(t)) {
    return { style: "cycle", pointCount: 5, reason: "Cyclical / looping flow detected" };
  }
  if (/\b(pyramid|hierarch|tier|tiers|maslow|levels?\b|stack)/.test(t)) {
    return { style: "pyramid", pointCount: 4, reason: "Hierarchy / pyramid detected" };
  }
  if (/\b(versus|vs\.?|compare|comparison|head[\s-]?to[\s-]?head|side[\s-]?by[\s-]?side)\b/.test(t)) {
    return { style: "comparison", pointCount: 3, reason: "Comparison / vs detected" };
  }
  if (/\b(stat|number|figures?|metrics?|kpi|hero\s+number|%|percent)\b/.test(t)) {
    return { style: "stat_spotlight", pointCount: 3, reason: "Stat spotlight detected" };
  }
  if (/\b(process|workflow|methodology|how to|step[s]?|stages?|phases?)\b/.test(t)) {
    // Try to extract a count from the prompt
    const count = extractCount(t);
    return {
      style: "process",
      pointCount: count ?? 5,
      reason: `Process flow${count ? ` (${count} steps)` : ""} detected`,
    };
  }

  // ─── Numbered list catch ──
  // "5 forces", "three trends", "four reasons" etc.
  const count = extractCount(t);
  if (count) {
    return {
      style: "numbered_list",
      pointCount: count,
      reason: `Numbered list with ${count} points`,
    };
  }

  // ─── Default ──
  return { style: "numbered_list", pointCount: 5, reason: "Numbered list (default)" };
}

const NUMBER_WORDS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7,
  "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
};

function extractCount(text: string): number | null {
  // "5 reasons", "three things", "four steps" etc.
  const m = text.match(/\b(three|four|five|six|seven|3|4|5|6|7)\b/);
  if (!m) return null;
  return NUMBER_WORDS[m[1]] ?? null;
}

const STYLE_LABELS: Record<InfographicStyle, string> = {
  process: "Process Flow",
  quadrant: "Strategy Quadrant",
  comparison: "Comparison Matrix",
  numbered_list: "Numbered List",
  timeline: "Timeline",
  stat_spotlight: "Stat Spotlight",
  pyramid: "Hierarchy Pyramid",
  cycle: "Cycle / Loop",
  five_forces: "Five Forces",
};

const EXAMPLE_PROMPTS = [
  "Five forces shaping AI adoption in pharma",
  "3 stages of digital transformation for retail banks",
  "2x2 of risk vs reward for emerging market expansion",
  "Timeline of generative AI in education from 2020 to 2030",
  "Compare synchronous vs asynchronous learning",
  "PDCA cycle for continuous improvement in operations",
  "Hierarchy of leadership skills from individual contributor to CEO",
  "4 trends reshaping the consumer goods industry in 2026",
];

export default function CreateInfographicPromptPage() {
  const navigate = useNavigate();
  const { sendBuildInfographic } = useAgent();
  const [brand, setBrand] = useActiveBrand();

  const [prompt, setPrompt] = useState("");

  // Recompute the inference on every keystroke. Cheap regex match,
  // useMemo just to avoid retriggering downstream renders unnecessarily.
  const inference = useMemo(
    () => (prompt.trim() ? inferStyleAndCount(prompt) : null),
    [prompt],
  );

  // Allow the user to override the auto-pick. If they manually pick a
  // style, we respect it; if they go back to "Auto", we re-derive.
  const [overrideStyle, setOverrideStyle] = useState<InfographicStyle | null>(null);
  const effectiveStyle = overrideStyle ?? inference?.style ?? "numbered_list";
  const effectivePointCount = overrideStyle ? defaultCountFor(overrideStyle) : inference?.pointCount ?? 5;

  function defaultCountFor(s: InfographicStyle): number {
    if (s === "quadrant") return 4;
    if (s === "five_forces") return 5;
    if (s === "comparison") return 3;
    if (s === "stat_spotlight") return 3;
    if (s === "pyramid") return 4;
    return 5;
  }

  const isValid = prompt.trim().length > 4;

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const id =
      "ig-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

    saveInfographic({
      id,
      title: prompt.trim(),
      topic: prompt.trim(),
      style: effectiveStyle,
      pointCount: effectivePointCount,
      notes: `[Quick Prompt mode] User wrote: "${prompt.trim()}". Auto-detected layout: ${effectiveStyle} with ${effectivePointCount} points.`,
      subtitle: "",
      points: [],
      costUsd: null,
      format: "png",
      useBrandColors: true,
      includePeopleImages: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    sendBuildInfographic({
      infographicId: id,
      topic: prompt.trim(),
      style: effectiveStyle,
      pointCount: effectivePointCount,
      notes: [
        `[Quick Prompt mode] The user described the infographic in plain words rather than filling out the structured form.`,
        `User prompt: "${prompt.trim()}"`,
        `Auto-detected layout: ${effectiveStyle} with ${effectivePointCount} points.`,
        `If you think a different layout would communicate the idea more clearly, override gracefully and adjust the point count to match — the user trusts your judgment here.`,
        `Use brand colors and brand-professional typography choices in the output.`,
      ].join("\n\n"),
    });

    navigate(`/infographics/${id}`);
  }

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

          <header className="section-header mb-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-3">
              <Sparkles size={11} strokeWidth={2.5} />
              New
            </div>
            <h2 className="section-title">Describe your infographic.</h2>
            <p className="section-sub">
              Type a sentence. Studio Copilot picks the layout, drafts the
              points, and renders it for download. Need surgical control?{" "}
              <Link
                to="/infographics/new"
                className="text-brand-700 font-semibold hover:underline"
              >
                Use the detailed brief →
              </Link>
            </p>
          </header>

          {/* Track-SS (Deckster v2): output format trio.
              Surfaced upfront so the LD knows the prompt will yield
              ALL three: a printable PNG, a paste-into-NovoEd HTML
              embed, and a standalone interactive HTML (click-to-flip /
              reveal / expand). The first two are handed off to the
              existing Studio export buttons; the interactive variant
              is new in v2 and uses the SCORM component library
              under the hood. */}
          <div className="mb-10 grid grid-cols-3 gap-3 animate-fade-up">
            <div className="px-3 py-2.5 rounded-lg bg-white border border-ink-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">
                Static
              </div>
              <div className="text-xs font-semibold text-ink-900">PNG image</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Slides, decks, print
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white border border-ink-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">
                Embed
              </div>
              <div className="text-xs font-semibold text-ink-900">HTML for NovoEd</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Paste into Froala
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-brand-50 border border-brand-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-0.5 flex items-center gap-1">
                <Sparkles size={9} strokeWidth={2.5} />
                Interactive
              </div>
              <div className="text-xs font-semibold text-ink-900">SCORM-ready HTML</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Flip, expand, reveal
              </div>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6 stagger-children">
            <div>
              <label className="block">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-sm font-bold text-ink-900">
                    What do you want to show?
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Required
                  </span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setOverrideStyle(null); // re-derive when prompt changes
                  }}
                  placeholder="e.g. Five forces shaping AI adoption in pharma&#10;e.g. 3 stages of digital transformation for retail banks&#10;e.g. 2x2 of risk vs reward for emerging market expansion"
                  rows={5}
                  className="form-textarea text-base"
                  autoFocus
                />
              </label>
            </div>

            {/* Examples — clickable chips that fill the prompt */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Try one of these
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => {
                      setPrompt(ex);
                      setOverrideStyle(null);
                    }}
                    className="form-chip text-left"
                    title="Click to use this prompt"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-detected layout indicator. Surfaces the heuristic
                so the user can sanity-check + override before submit. */}
            {inference && (
              <div className="px-4 py-3 bg-brand-50 border border-brand-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Wand2 size={14} className="text-brand-700" strokeWidth={2.5} />
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                    Auto-detected layout
                  </span>
                </div>
                <div className="text-sm text-ink-900 mb-2">
                  <strong>{STYLE_LABELS[effectiveStyle]}</strong> with {effectivePointCount} points
                  {!overrideStyle && (
                    <span className="text-ink-500 font-normal italic ml-1">
                      — {inference.reason}
                    </span>
                  )}
                </div>
                {/* Override chip row — collapsed by default, expanded on
                    a "change layout" click. Keep the surface clean. */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-brand-700 hover:text-brand-800 font-semibold">
                    Change layout →
                  </summary>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setOverrideStyle(null)}
                      className={
                        !overrideStyle
                          ? "form-chip form-chip-active text-xs"
                          : "form-chip text-xs"
                      }
                    >
                      Auto
                    </button>
                    {(Object.keys(STYLE_LABELS) as InfographicStyle[]).map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setOverrideStyle(s)}
                        className={
                          overrideStyle === s
                            ? "form-chip form-chip-active text-xs"
                            : "form-chip text-xs"
                        }
                      >
                        {STYLE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Brand picker — kept compact since prompt mode is about
                speed, not configuration. The user can still pick brand
                because the output color cascade flows from this. */}
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

            <div className="pt-2">
              <button type="submit" disabled={!isValid} className="btn-cta-primary">
                Generate <ArrowRight size={14} strokeWidth={2.5} />
              </button>
              {!isValid && prompt.trim().length > 0 && (
                <p className="text-caption text-ink-400 mt-2">
                  Add a few more words so we can pick the right layout.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
