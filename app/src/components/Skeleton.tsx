/**
 * Skeleton — reusable shimmer-block component.
 *
 * Replaces generic "Loading…" spinners with a faded preview of the
 * destination layout. Vercel / Linear / Arc / Notion all do this:
 * when async work is in flight, show the SHAPE of what's coming,
 * not a circle that says "wait." The result reads as "the page
 * is forming" rather than "the system is stuck."
 *
 * Three primitives:
 *   <Skeleton.Line w="60%" />        — a single line, optional width
 *   <Skeleton.Block h={120} />       — a sized rectangle
 *   <Skeleton.Stack count={4} />     — N lines with decreasing widths
 *
 * Plus higher-order layout shapes for the studios:
 *   <Skeleton.InfographicCard />     — preview of an infographic point card
 *   <Skeleton.LessonOutline />       — preview of a course outline tree
 *   <Skeleton.LessonBlocks />        — preview of a stack of lesson blocks
 *
 * Animation: a 1.4s shimmer sweep via CSS keyframes. Respects
 * prefers-reduced-motion (disables the shimmer, keeps the fill).
 *
 * Theming: uses CSS vars (var(--skeleton-bg) / var(--skeleton-shimmer))
 * so the same component works on light + dark surfaces. Defaults to
 * a soft ink-100 fill for light mode.
 */
import type { CSSProperties, ReactNode } from "react";

interface BaseProps {
  className?: string;
  style?: CSSProperties;
}

interface LineProps extends BaseProps {
  /** Width as CSS length or percent. Defaults to 100%. */
  w?: string;
  /** Height as CSS length. Defaults to 14px. */
  h?: number | string;
}

function Line({ w = "100%", h = 14, className = "", style }: LineProps) {
  return (
    <span
      className={`skeleton skeleton-line ${className}`}
      style={{ width: w, height: typeof h === "number" ? `${h}px` : h, ...style }}
      aria-hidden="true"
    />
  );
}

interface BlockProps extends BaseProps {
  w?: string;
  h?: number | string;
  rounded?: number;
}

function Block({ w = "100%", h = 80, rounded = 8, className = "", style }: BlockProps) {
  return (
    <div
      className={`skeleton skeleton-block ${className}`}
      style={{
        width: w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: `${rounded}px`,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

interface StackProps extends BaseProps {
  /** How many lines to render. Each successive line is slightly narrower. */
  count?: number;
  /** Base width of the first line. Defaults to 100%. */
  w?: string;
  /** Gap between lines. */
  gap?: number;
}

function Stack({ count = 3, w = "100%", gap = 8, className = "" }: StackProps) {
  const widths = Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return "55%"; // last line short
    return w;
  });
  return (
    <div className={`flex flex-col ${className}`} style={{ gap }}>
      {widths.map((width, i) => (
        <Line key={i} w={width} />
      ))}
    </div>
  );
}

/** Preview of an infographic point card — heading + body lines. */
function InfographicCard() {
  return (
    <div className="skeleton-card-frame" aria-hidden="true">
      <div className="flex items-center gap-3 mb-3">
        <Block w="36px" h={36} rounded={8} />
        <Line w="40%" h={16} />
      </div>
      <Stack count={3} gap={6} />
    </div>
  );
}

/** Preview of an entire infographic — header + N point cards. */
interface InfographicShellProps {
  count?: number;
}

function InfographicShell({ count = 5 }: InfographicShellProps) {
  return (
    <div className="skeleton-infographic-shell" aria-hidden="true">
      <div className="mb-8">
        <Line w="32%" h={11} className="mb-3" />
        <Line w="68%" h={28} className="mb-2" />
        <Line w="50%" h={14} />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {Array.from({ length: count }, (_, i) => (
          <InfographicCard key={i} />
        ))}
      </div>
    </div>
  );
}

/** Preview of a course outline — module + lessons tree. */
function LessonOutline() {
  return (
    <div className="skeleton-outline" aria-hidden="true">
      {[0, 1, 2, 3].map((m) => (
        <div key={m} className="mb-5">
          <Line w="60%" h={16} className="mb-3" />
          <div className="ml-4 space-y-2">
            <Line w="80%" />
            <Line w="72%" />
            <Line w="68%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Preview of a stack of lesson blocks — text + section + text + accordion. */
function LessonBlocks() {
  return (
    <div className="skeleton-blocks space-y-6" aria-hidden="true">
      <Block h={48} />
      <Stack count={4} />
      <Block h={120} rounded={12} />
      <Stack count={3} />
      <Block h={80} rounded={12} />
    </div>
  );
}

/** Layout wrapper that adds a soft-pulse animation envelope. */
function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`skeleton-wrap ${className}`}>{children}</div>;
}

export const Skeleton = {
  Line,
  Block,
  Stack,
  Wrap,
  InfographicCard,
  InfographicShell,
  LessonOutline,
  LessonBlocks,
};
