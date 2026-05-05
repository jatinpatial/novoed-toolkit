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

/**
 * Track-BFL (BCG Framework Library): curated set of consulting
 * frameworks that LDs commonly reach for. Each framework provides:
 *
 *   - A prompt template that the LD fills with their topic. The
 *     template is structured so the agent's MODE 6 generates the
 *     framework's expected POINTS shape (e.g. five_forces template
 *     produces 5 points, one per force; SCQA template produces 4
 *     points keyed by the framework's verbs).
 *   - A locked layout style — the framework only renders correctly
 *     in one style, so we override the auto-detect.
 *   - A 1-line "what's this" description so LDs who don't know the
 *     framework still get value.
 *
 * These ARE the BCG-distinctive moat. Every L&D tool can produce a
 * 5-point list; only ours opens with "Apply Porter's Five Forces"
 * as a one-click action.
 */
interface BcgFramework {
  id: string;
  name: string;
  description: string;
  /** Layout the framework requires. */
  style: InfographicStyle;
  /** Point count the framework requires. */
  pointCount: number;
  /** Prompt template — replace {TOPIC} when the LD picks a framework. */
  promptTemplate: string;
  /** What to put in the prompt textarea by default. {TOPIC} placeholder. */
  placeholder: string;
}

const BCG_FRAMEWORKS: BcgFramework[] = [
  {
    id: "porter5",
    name: "Porter's Five Forces",
    description: "Industry attractiveness — central concept + 5 surrounding forces",
    style: "five_forces",
    pointCount: 5,
    promptTemplate: "Apply Porter's Five Forces to {TOPIC}. Generate one point per force: rivalry among existing competitors, threat of new entrants, threat of substitutes, bargaining power of suppliers, bargaining power of buyers. Each point names the force, then explains how it applies to {TOPIC} in 15-30 words.",
    placeholder: "the wearable health-tech industry in 2026",
  },
  {
    id: "scqa",
    name: "SCQA",
    description: "Situation → Complication → Question → Answer (Pyramid Principle)",
    style: "pyramid",
    pointCount: 4,
    promptTemplate: "Apply Barbara Minto's SCQA structure to {TOPIC}. Generate exactly 4 points labeled Situation, Complication, Question, Answer. The Situation establishes shared context the audience already knows. The Complication introduces what changed or what's now at stake. The Question articulates the central decision. The Answer states the recommendation.",
    placeholder: "why our pricing strategy needs to change",
  },
  {
    id: "growth-share",
    name: "BCG Growth-Share Matrix",
    description: "Star / Cash Cow / Question Mark / Dog — portfolio quadrant",
    style: "quadrant",
    pointCount: 4,
    promptTemplate: "Apply the BCG Growth-Share Matrix to {TOPIC}. Generate exactly 4 points: Stars (high growth, high share), Cash Cows (low growth, high share), Question Marks (high growth, low share), Dogs (low growth, low share). For each, describe the strategic posture the topic suggests for that quadrant.",
    placeholder: "our product portfolio across emerging markets",
  },
  {
    id: "horizons",
    name: "Three Horizons",
    description: "McKinsey's Horizon 1 / 2 / 3 framework for innovation portfolios",
    style: "process",
    pointCount: 3,
    promptTemplate: "Apply the Three Horizons framework to {TOPIC}. Generate exactly 3 points: Horizon 1 (defend and extend the core, 0-2 year payoff), Horizon 2 (build emerging businesses, 2-5 year payoff), Horizon 3 (create viable options for the future, 5+ year payoff). Each point describes the implications for {TOPIC} at that horizon.",
    placeholder: "our AI investment portfolio",
  },
  {
    id: "scurve",
    name: "S-Curve",
    description: "Adoption / maturity curve — emerging → growth → mature → declining",
    style: "timeline",
    pointCount: 4,
    promptTemplate: "Apply the S-curve adoption framework to {TOPIC}. Generate 4 points along the curve: Emerging (slow early adoption, validation phase), Take-off (steepening curve, network effects kick in), Maturity (growth flattens, optimization phase), Decline or Reinvention (the next S-curve begins). Frame each in the context of {TOPIC}.",
    placeholder: "generative AI in enterprise workflows",
  },
  {
    id: "mece",
    name: "MECE Breakdown",
    description: "Mutually Exclusive, Collectively Exhaustive — clean decomposition",
    style: "numbered_list",
    pointCount: 5,
    promptTemplate: "Decompose {TOPIC} into 5 MECE (Mutually Exclusive, Collectively Exhaustive) categories. The categories should NOT overlap, and together should cover the entire topic with no gaps. Order from highest to lowest impact. State the category in the heading; explain its boundary in the body so the reader sees why it's distinct from the others.",
    placeholder: "the drivers of customer churn in B2B SaaS",
  },
  {
    id: "7s",
    name: "McKinsey 7S",
    description: "Strategy / Structure / Systems / Shared values / Style / Staff / Skills",
    style: "five_forces",
    pointCount: 5,
    promptTemplate: "Apply McKinsey's 7S framework to {TOPIC}, but consolidate to the 5 most relevant Ss for this topic. Pick from: Strategy, Structure, Systems, Shared Values, Style, Staff, Skills. For each chosen S, name it in the heading, then describe how it shapes {TOPIC} in 15-30 words.",
    placeholder: "our merger integration strategy",
  },
  {
    id: "compass",
    name: "Strategy Compass",
    description: "2x2 — Differentiation vs cost, focus vs broad market",
    style: "quadrant",
    pointCount: 4,
    promptTemplate: "Apply Porter's Generic Strategies (a 2x2 of Differentiation vs Cost Leadership crossed with Broad Market vs Focused Niche) to {TOPIC}. Generate 4 points: broad differentiation, broad cost leadership, focused differentiation, focused cost leadership. For each, describe the strategic posture and one example move {TOPIC} could make there.",
    placeholder: "competing in the EV charging infrastructure market",
  },
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

  // Track-BFL: when a BCG framework is selected, the prompt becomes
  // a fill-in-the-topic exercise — the framework's promptTemplate
  // does the heavy lifting on the agent side. Layout + point count
  // are locked to whatever the framework requires (you can't render
  // a 2x2 with 5 points). Setting framework also seeds overrideStyle
  // so the auto-detect doesn't fight the framework's choice.
  const [framework, setFramework] = useState<BcgFramework | null>(null);

  function applyFramework(fw: BcgFramework) {
    setFramework(fw);
    setOverrideStyle(fw.style);
    // v3 fix: do NOT touch the textarea. Original v2 seeded it with
    // the framework's placeholder topic; user feedback was that this
    // felt like the form was "rewriting itself" mid-edit. Now the
    // framework only locks layout + sends framework guidance via
    // notes — the textarea stays exactly as the LD typed it. The
    // placeholder example shows up as a textarea placeholder
    // attribute instead (see textarea below).
  }
  function clearFramework() {
    setFramework(null);
    setOverrideStyle(null);
  }

  const effectiveStyle = framework
    ? framework.style
    : overrideStyle ?? inference?.style ?? "numbered_list";
  const effectivePointCount = framework
    ? framework.pointCount
    : overrideStyle
    ? defaultCountFor(overrideStyle)
    : inference?.pointCount ?? 5;

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

    // Track-BFL: when a framework is active, the prompt textarea
    // contains the LD's TOPIC; the framework's promptTemplate
    // articulates the structure the agent should produce. We pass
    // the rendered template (TOPIC injected) as `notes` so the
    // agent reads framework guidance + topic together.
    const notesArr: string[] = [];
    if (framework) {
      notesArr.push(`[BCG Framework: ${framework.name}]`);
      notesArr.push(framework.promptTemplate.replace(/\{TOPIC\}/g, prompt.trim()));
      notesArr.push(
        `Layout is locked to ${framework.style} with exactly ${framework.pointCount} points — that's what the framework requires.`,
      );
    } else {
      notesArr.push(
        `[Quick Prompt mode] The user described the infographic in plain words rather than filling out the structured form.`,
      );
      notesArr.push(`User prompt: "${prompt.trim()}"`);
      notesArr.push(
        `Auto-detected layout: ${effectiveStyle} with ${effectivePointCount} points.`,
      );
      notesArr.push(
        `If you think a different layout would communicate the idea more clearly, override gracefully and adjust the point count to match — the user trusts your judgment here.`,
      );
    }
    notesArr.push(
      `Use brand colors and brand-professional typography choices in the output.`,
    );

    sendBuildInfographic({
      infographicId: id,
      topic: prompt.trim(),
      style: effectiveStyle,
      pointCount: effectivePointCount,
      notes: notesArr.join("\n\n"),
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

          {/* v3 fix: header was wrapping "Describe your infographic."
              awkwardly because section-header puts the NEW pill +
              title on the same row. Restructured so the pill sits
              above the title cleanly, and the title doesn't try to
              wrap around it. */}
          <header className="mb-8 animate-fade-up">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-3">
              <Sparkles size={11} strokeWidth={2.5} />
              New
            </div>
            <h2 className="text-h1 text-ink-900 font-extrabold tracking-tight mb-3">
              Describe your infographic.
            </h2>
            <p className="text-sm text-ink-500 leading-relaxed max-w-2xl">
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

          {/* Track-SS v3: output format trio — corrected per NovoEd
              toolkit's HTML-vs-SCORM split. HTML is STATIC (Froala
              embed only — no JS supported), SCORM is INTERACTIVE
              (.zip with imsmanifest.xml, uploadable to any LMS).
              Three formats, three workflows: print/slide deck (PNG),
              embed in a NovoEd lesson (Static HTML), upload as a
              standalone interactive activity (SCORM). */}
          <div className="mb-10 grid grid-cols-3 gap-3 animate-fade-up">
            <div className="px-3 py-2.5 rounded-lg bg-white border border-ink-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">
                Print / Slide
              </div>
              <div className="text-xs font-semibold text-ink-900">PNG image</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Decks, exports, social
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-white border border-ink-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-0.5">
                Static embed
              </div>
              <div className="text-xs font-semibold text-ink-900">HTML for Froala</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Paste into NovoEd lesson
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-lg bg-brand-50 border border-brand-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-0.5 flex items-center gap-1">
                <Sparkles size={9} strokeWidth={2.5} />
                Interactive
              </div>
              <div className="text-xs font-semibold text-ink-900">SCORM .zip</div>
              <div className="text-[10px] text-ink-400 leading-tight mt-0.5">
                Click, flip, reveal — any LMS
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
                    // Don't clear framework on every keystroke — the
                    // framework only clears via the explicit "Clear
                    // framework ×" button. Otherwise a typo would
                    // un-lock the layout, surprising the LD.
                    if (!framework) setOverrideStyle(null);
                  }}
                  placeholder={
                    framework
                      ? `e.g. ${framework.placeholder}`
                      : "e.g. Five forces shaping AI adoption in pharma\ne.g. 3 stages of digital transformation for retail banks\ne.g. 2x2 of risk vs reward for emerging market expansion"
                  }
                  rows={5}
                  className="form-textarea text-base"
                  autoFocus
                />
              </label>
            </div>

            {/* Track-BFL: BCG Framework Library — one-click templates
                for the consulting frameworks LDs reach for most.
                Picking a framework: locks the layout, fills the
                placeholder topic, routes the agent's prompt through
                the framework's structured guidance. The active
                framework shows as a chip with X to clear. */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  BCG Framework Library
                </span>
                {framework && (
                  <button
                    type="button"
                    onClick={clearFramework}
                    className="text-[10px] font-bold uppercase tracking-wider text-brand-700 hover:underline"
                  >
                    Clear framework ×
                  </button>
                )}
              </div>
              {framework ? (
                <div className="px-4 py-3 bg-brand-700 text-white rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
                    Active framework
                  </div>
                  <div className="text-sm font-bold mb-0.5">{framework.name}</div>
                  <div className="text-xs opacity-90 leading-relaxed">
                    {framework.description}
                  </div>
                  <div className="text-[10px] opacity-70 mt-2 italic">
                    Layout locked to {STYLE_LABELS[framework.style]} with {framework.pointCount} points. Type your topic above — the framework does the rest.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {BCG_FRAMEWORKS.map((fw) => (
                    <button
                      type="button"
                      key={fw.id}
                      onClick={() => applyFramework(fw)}
                      className="form-chip text-left flex flex-col items-start py-2.5 px-3"
                      title={fw.description}
                    >
                      <span className="text-xs font-bold text-ink-900">{fw.name}</span>
                      <span className="text-[10px] text-ink-500 leading-tight mt-0.5">
                        {fw.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Free-text examples — clickable chips that fill the prompt */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Or try a free-text example
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => {
                      setPrompt(ex);
                      setOverrideStyle(null);
                      setFramework(null);
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
