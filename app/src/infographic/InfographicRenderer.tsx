import { ArrowRight } from "lucide-react";
import type { BcgIconName } from "../icons/BcgIcon";
import * as BcgIcons from "../icons/bcg";
import type { ComponentType, SVGProps } from "react";
import type { InfographicPoint, InfographicStyle } from "../store/infographics";

/**
 * Track-G / G3: InfographicRenderer.
 *
 * Single component that switches on `style` and lays out the agent's
 * structured points appropriately. Each style is its own subcomponent
 * below — the switch keeps the file scannable.
 *
 * Styles:
 *   process       Numbered sequence with arrows
 *   quadrant      2x2 matrix
 *   comparison    2-3 columns side-by-side
 *   numbered_list Vertical large-number list
 *   timeline      Horizontal flow with markers
 *
 * Track-X1: switched icon set from lucide-react to the BCG icon library
 * (app/src/icons/bcg). The BCG icons are content-domain illustrations
 * — Strategy, BusinessProcess, BrainNetwork, GroupCollaboration etc.
 * — that read as "this is a real BCG learning artifact" instead of
 * generic UI glyphs. Lucide stays for UI affordances (ArrowRight in
 * the process layout). The Icon resolver below handles both BCG names
 * (preferred, e.g. "Strategy") and legacy kebab-case lucide hints from
 * pre-X1 saved infographics (e.g. "trending-up") so old projects don't
 * break.
 *
 * Brand awareness: BCG icons render with fill="currentColor", so the
 * .ig-icon class can drive color via CSS (text-brand-700). Toggling
 * brand on the form re-runs the cascade vars and repaints without
 * re-render.
 */

interface RendererProps {
  title: string;
  subtitle: string;
  style: InfographicStyle;
  points: InfographicPoint[];
}

export function InfographicRenderer({ title, subtitle, style, points }: RendererProps) {
  return (
    <div className="ig-frame">
      <div className="ig-header">
        <h2 className="ig-title">{title}</h2>
        {subtitle && <p className="ig-subtitle">{subtitle}</p>}
      </div>
      <div className="ig-body">
        {style === "process" && <ProcessLayout points={points} />}
        {style === "quadrant" && <QuadrantLayout points={points} />}
        {style === "comparison" && <ComparisonLayout points={points} />}
        {style === "numbered_list" && <NumberedListLayout points={points} />}
        {style === "timeline" && <TimelineLayout points={points} />}
      </div>
    </div>
  );
}

// ─── Style: Process ───────────────────────────────────────────────────────────

function ProcessLayout({ points }: { points: InfographicPoint[] }) {
  return (
    <div className="ig-process">
      {points.map((p, i) => (
        <div key={i} className="ig-process-item">
          <div className="ig-process-number">{i + 1}</div>
          <div className="ig-process-content">
            <div className="ig-process-heading-row">
              <Icon hint={p.iconHint} fallback="BusinessProcess" size={32} />
              <h3 className="ig-point-heading">{p.heading}</h3>
            </div>
            <p className="ig-point-body">{p.body}</p>
          </div>
          {i < points.length - 1 && (
            <ArrowRight className="ig-process-arrow" size={20} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Style: Quadrant (2x2) ───────────────────────────────────────────────────

function QuadrantLayout({ points }: { points: InfographicPoint[] }) {
  // Pad / clip to exactly 4 quadrants. If the agent emitted fewer, fill
  // remaining slots with empty placeholders so the 2x2 grid stays
  // structurally complete. If more, take the first 4 and surface the
  // count overflow inline so the LD knows.
  const quad = points.slice(0, 4);
  while (quad.length < 4) {
    quad.push({ heading: "", body: "" });
  }
  const overflow = points.length - 4;

  return (
    <div className="ig-quadrant">
      <div className="ig-quadrant-grid">
        {quad.map((p, i) => (
          <div key={i} className="ig-quadrant-cell">
            <div className="ig-quadrant-heading-row">
              <Icon hint={p.iconHint} fallback={QUAD_DEFAULTS[i]} size={36} />
              <h3 className="ig-point-heading">{p.heading || `Cell ${i + 1}`}</h3>
            </div>
            <p className="ig-point-body">{p.body}</p>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="ig-overflow-note">
          +{overflow} additional point{overflow === 1 ? "" : "s"} not shown — quadrant style fits 4
        </div>
      )}
    </div>
  );
}

// One default per quadrant cell — Strategy / Innovation / Coach / LightBulb
// reads as "frame the move, push the new idea, bring the people, spark the
// insight" without any one cell looking generic.
const QUAD_DEFAULTS: BcgIconName[] = ["Strategy", "Innovation", "Coach", "LightBulb"];

// ─── Style: Comparison ───────────────────────────────────────────────────────

function ComparisonLayout({ points }: { points: InfographicPoint[] }) {
  // Comparison styles read best with 2-3 columns; clip if more.
  const cols = points.slice(0, 3);
  return (
    <div className="ig-comparison">
      {cols.map((p, i) => (
        <div key={i} className="ig-comparison-col">
          <div className="ig-comparison-header">
            <Icon hint={p.iconHint} fallback="CustomerInsight" size={44} />
            <h3 className="ig-point-heading-large">{p.heading}</h3>
          </div>
          <p className="ig-point-body">{p.body}</p>
        </div>
      ))}
      {points.length > 3 && (
        <div className="ig-overflow-note">
          +{points.length - 3} additional column{points.length - 3 === 1 ? "" : "s"} not shown
        </div>
      )}
    </div>
  );
}

// ─── Style: Numbered list ────────────────────────────────────────────────────

function NumberedListLayout({ points }: { points: InfographicPoint[] }) {
  return (
    <div className="ig-numbered-list">
      {points.map((p, i) => (
        <div key={i} className="ig-numbered-row">
          <div className="ig-numbered-large">{i + 1}</div>
          <div className="ig-numbered-content">
            <div className="ig-numbered-heading-row">
              <Icon hint={p.iconHint} fallback="FiveSteps" size={32} />
              <h3 className="ig-point-heading">{p.heading}</h3>
            </div>
            <p className="ig-point-body">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Style: Timeline ─────────────────────────────────────────────────────────

function TimelineLayout({ points }: { points: InfographicPoint[] }) {
  return (
    <div className="ig-timeline">
      <div className="ig-timeline-line" aria-hidden="true" />
      {points.map((p, i) => (
        <div key={i} className="ig-timeline-item">
          <div className="ig-timeline-marker">
            <Icon hint={p.iconHint} fallback="Clock" size={28} />
          </div>
          <div className="ig-timeline-content">
            <h3 className="ig-point-heading">{p.heading}</h3>
            <p className="ig-point-body">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Icon resolver ───────────────────────────────────────────────────────────

/**
 * Legacy lucide-style → BCG name map, for infographics drafted before
 * Track-X1 (when MODE 6 emitted kebab-case lucide hints). Each entry
 * picks the closest BCG-domain match — not always exact, but always
 * better than a fallback chip.
 *
 * Pre-X1 saved infographics survive: their iconHint values still
 * resolve, just to a richer-looking BCG illustration.
 */
const LEGACY_LUCIDE_TO_BCG: Record<string, BcgIconName> = {
  "trending-up":  "BarChart",
  "trendingup":   "BarChart",
  "users":        "GroupCollaboration",
  "shield":       "Coach",
  "target":       "Target",
  "brain":        "BrainNetwork",
  "lightbulb":    "LightBulb",
  "alert-circle": "Alert",
  "alertcircle":  "Alert",
  "check-circle": "BetaTest",
  "checkcircle":  "BetaTest",
  "check":        "BetaTest",
  "clock":        "Clock",
  "book-open":    "ClosedBook",
  "bookopen":     "ClosedBook",
  "sparkles":     "Innovation",
  "zap":          "Innovation",
  "arrow-right":  "BusinessProcess",
  "bar-chart":    "BarChart",
  "barchart":     "BarChart",
  "pie-chart":    "DataAnalysis",
  "piechart":     "DataAnalysis",
  "flag":         "Target",
  "heart":        "Handshake",
  "star":         "Trophy",
  "compass":      "Strategy",
  "layers":       "Hierarchy",
};

/**
 * Resolve an agent-emitted iconHint to a BCG icon component.
 *
 * Resolution order:
 *  1. Direct match on a BCG icon name (case-insensitive). MODE 6 prompt
 *     emits these directly (e.g. "Strategy", "BusinessProcess").
 *  2. Legacy kebab-case lucide hint → BCG mapping (e.g. "trending-up"
 *     → BarChart). Keeps pre-X1 saves rendering cleanly.
 *  3. Per-layout fallback BCG name supplied by the caller.
 */
function resolveBcgName(hint: string | undefined, fallback: BcgIconName): BcgIconName {
  if (!hint) return fallback;
  const trimmed = hint.trim();
  if (!trimmed) return fallback;

  // 1. Direct BCG-name lookup (exact match preferred — agent output
  //    is PascalCase per the X1.5 prompt). We match both case-sensitive
  //    and case-insensitive to be forgiving of "strategy" vs "Strategy".
  if (trimmed in BcgIcons) {
    return trimmed as BcgIconName;
  }
  const lowered = trimmed.toLowerCase();
  for (const key of Object.keys(BcgIcons) as BcgIconName[]) {
    if (key.toLowerCase() === lowered) return key;
  }

  // 2. Legacy lucide-style kebab-case → BCG mapping.
  const legacy = LEGACY_LUCIDE_TO_BCG[lowered];
  if (legacy) return legacy;

  // 3. Per-layout fallback.
  return fallback;
}

/**
 * Renders a BCG icon at the given size. The wrapper assigns the `ig-icon`
 * class so currentColor is driven by the cascade (text-brand-700 in CSS).
 *
 * We bypass <BcgIcon> in favor of `BcgIcons[name]` directly because the
 * wrapper expects strict BcgIconName typing — but our resolver already
 * narrowed the name. Same end result, one fewer cast.
 */
function Icon({
  hint,
  fallback,
  size = 28,
}: {
  hint?: string;
  fallback: BcgIconName;
  size?: number;
}) {
  const name = resolveBcgName(hint, fallback);
  const Resolved = BcgIcons[name] as ComponentType<SVGProps<SVGSVGElement>>;
  return <Resolved width={size} height={size} className="ig-icon" />;
}
