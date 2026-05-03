import {
  ArrowRight, BarChart3, BookOpen, Brain, Check, CheckCircle, Clock,
  Compass, Flag, Heart, Layers, Lightbulb, PieChart, Shield, Sparkles,
  Star, Target, TrendingUp, Users, Zap, AlertCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
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
 * iconHint resolution: agent emits a lucide icon name (e.g.
 * "trending-up"); we map to the imported component. Out-of-set
 * names fall through to a sensible default per style.
 *
 * Brand awareness: uses var(--brand-500) / var(--brand-700) cascade
 * vars throughout so toggling brand on the TopBar repaints the
 * infographic without re-render.
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
              <Icon hint={p.iconHint} fallback={Target} className="ig-icon" />
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
              <Icon hint={p.iconHint} fallback={QUAD_DEFAULTS[i]} className="ig-icon" />
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

const QUAD_DEFAULTS = [Target, TrendingUp, Shield, Sparkles];

// ─── Style: Comparison ───────────────────────────────────────────────────────

function ComparisonLayout({ points }: { points: InfographicPoint[] }) {
  // Comparison styles read best with 2-3 columns; clip if more.
  const cols = points.slice(0, 3);
  return (
    <div className="ig-comparison">
      {cols.map((p, i) => (
        <div key={i} className="ig-comparison-col">
          <div className="ig-comparison-header">
            <Icon hint={p.iconHint} fallback={Compass} className="ig-icon-large" />
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
              <Icon hint={p.iconHint} fallback={CheckCircle} className="ig-icon" />
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
            <Icon hint={p.iconHint} fallback={Flag} className="ig-icon" />
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

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  "trending-up": TrendingUp,
  "users": Users,
  "shield": Shield,
  "target": Target,
  "brain": Brain,
  "lightbulb": Lightbulb,
  "alert-circle": AlertCircle,
  "check-circle": CheckCircle,
  "clock": Clock,
  "book-open": BookOpen,
  "sparkles": Sparkles,
  "zap": Zap,
  "arrow-right": ArrowRight,
  "bar-chart": BarChart3,
  "pie-chart": PieChart,
  "flag": Flag,
  "heart": Heart,
  "star": Star,
  "compass": Compass,
  "layers": Layers,
  // Common typos / aliases
  "check": Check,
  "trendingup": TrendingUp,
  "alertcircle": AlertCircle,
  "checkcircle": CheckCircle,
  "bookopen": BookOpen,
  "barchart": BarChart3,
  "piechart": PieChart,
};

function Icon({
  hint,
  fallback: Fallback,
  className,
}: {
  hint?: string;
  fallback: ComponentType<LucideProps>;
  className?: string;
}) {
  const key = (hint || "").toLowerCase().trim();
  const Resolved = ICON_MAP[key] ?? Fallback;
  return <Resolved className={className} size={18} strokeWidth={2} />;
}
