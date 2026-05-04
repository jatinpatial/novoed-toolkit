import { ArrowRight } from "lucide-react";
import type { BcgIconName } from "../icons/BcgIcon";
import * as BcgIcons from "../icons/bcg";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import type { InfographicPoint, InfographicStyle } from "../store/infographics";

/**
 * Track-G / G3: InfographicRenderer.
 *
 * Single component that switches on `style` and lays out the agent's
 * structured points appropriately. Each style is its own subcomponent
 * below — the switch keeps the file scannable.
 *
 * Styles (Track-X2 — 9 layouts):
 *   process         Numbered sequence with arrows
 *   quadrant        2x2 strategy matrix
 *   comparison      2-3 columns side-by-side
 *   numbered_list   Vertical large-number list
 *   timeline        Horizontal flow with markers
 *   stat_spotlight  Hero number per cell with caption (3-5 cells)
 *   pyramid         3-5 stacked levels narrowing toward apex
 *   cycle           Closed-loop circular flow (4-6 phases)
 *   five_forces     Porter-style central concept + 4-5 surrounding forces
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
 * Track-X2: four new specialized layouts (stat_spotlight, pyramid,
 * cycle, five_forces). Each has a distinct content shape — they're
 * not interchangeable with the core 5. Picking style is now a real
 * design decision, not a cosmetic one.
 *
 * Brand awareness: BCG icons render with fill="currentColor", so the
 * .ig-icon class can drive color via CSS (text-brand-700). Toggling
 * brand on the form re-runs the cascade vars and repaints without
 * re-render.
 */

/** BB1: per-point text edit dispatcher. Receives the point index and
 *  which field changed; the parent (InfographicStudio) updates the
 *  underlying infographic in the store and re-renders. */
type PointField = "heading" | "body";
export type PointChangeHandler = (index: number, field: PointField, value: string) => void;

/** BB2: element key → CSS color string. Element keys mirror the JSX
 *  hierarchy: "title", "subtitle", "point-{i}-heading", "point-{i}-body".
 *  An empty/missing entry means "use brand cascade default". */
export type StyleOverrides = Record<string, string>;
export type StyleOverrideSetter = (key: string, color: string | null) => void;

interface RendererProps {
  title: string;
  subtitle: string;
  style: InfographicStyle;
  points: InfographicPoint[];
  /** BB1: when true, every text element on the renderer becomes a
   *  focus-toggle editor. Off by default so the renderer is safe to
   *  use for PNG export (no hover affordances or edit chrome). */
  editable?: boolean;
  /** BB1: called when a per-point text field changes. */
  onPointChange?: PointChangeHandler;
  /** BB1: called when the title changes. */
  onTitleChange?: (next: string) => void;
  /** BB1: called when the subtitle changes. */
  onSubtitleChange?: (next: string) => void;
  /** BB2: per-element color overrides keyed by element id. */
  styleOverrides?: StyleOverrides;
  /** BB2: called when the LD picks / resets a color for one element.
   *  null clears the override and falls back to the brand cascade. */
  onStyleOverride?: StyleOverrideSetter;
  /** BB2: which element key, if any, currently has its color-picker
   *  popover open. Lifted to the parent so PNG export can clear it
   *  before capture, and so only one picker is open at a time. */
  openPickerKey?: string | null;
  /** BB2: open / close the color-picker popover for an element key.
   *  Pass null to close. */
  setOpenPickerKey?: (key: string | null) => void;
}

export function InfographicRenderer({
  title,
  subtitle,
  style,
  points,
  editable = false,
  onPointChange,
  onTitleChange,
  onSubtitleChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: RendererProps) {
  // Track-X2: Five Forces shifts the title into the center of the frame
  // (it's the central concept the forces surround), so the standard
  // header is suppressed for that style. All other styles use the
  // standard top-aligned header.
  const showHeader = style !== "five_forces";
  const ed = {
    editable,
    onPointChange,
    styleOverrides,
    onStyleOverride,
    openPickerKey,
    setOpenPickerKey,
  };

  return (
    <div className={`ig-frame ig-frame-${style}${editable ? " ig-editable-mode" : ""}`}>
      {showHeader && (
        <div className="ig-header">
          <EditableText
            as="h2"
            className="ig-title"
            elementKey="title"
            value={title}
            editable={editable}
            onChange={onTitleChange}
            placeholder="Untitled infographic"
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
          {(subtitle || editable) && (
            <EditableText
              as="p"
              className="ig-subtitle"
              elementKey="subtitle"
              value={subtitle}
              editable={editable}
              onChange={onSubtitleChange}
              placeholder="Optional one-line framing"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          )}
        </div>
      )}
      <div className="ig-body">
        {style === "process"        && <ProcessLayout       points={points} {...ed} />}
        {style === "quadrant"       && <QuadrantLayout      points={points} {...ed} />}
        {style === "comparison"     && <ComparisonLayout    points={points} {...ed} />}
        {style === "numbered_list"  && <NumberedListLayout  points={points} {...ed} />}
        {style === "timeline"       && <TimelineLayout      points={points} {...ed} />}
        {style === "stat_spotlight" && <StatSpotlightLayout points={points} {...ed} />}
        {style === "pyramid"        && <PyramidLayout       points={points} {...ed} />}
        {style === "cycle"          && <CycleLayout         points={points} {...ed} />}
        {style === "five_forces"    && (
          <FiveForcesLayout
            points={points}
            title={title}
            subtitle={subtitle}
            editable={editable}
            onPointChange={onPointChange}
            onTitleChange={onTitleChange}
            onSubtitleChange={onSubtitleChange}
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
        )}
      </div>
    </div>
  );
}

// ─── EditableText ────────────────────────────────────────────────────────────
//
// BB1: focus-toggle editor inspired by CourseStudio's TextBlockEditor.
// Blurred state shows the rendered tag (h2 / h3 / p / div / span);
// focused state swaps to a plain <input> for single-line and
// <textarea> for multi-line. On blur, fires onChange and returns to
// the rendered shape. When `editable` is false, returns the rendered
// tag with no interactivity — safe for PNG export and read-only views.

type LayoutEditableProps = {
  editable?: boolean;
  onPointChange?: PointChangeHandler;
  styleOverrides?: StyleOverrides;
  onStyleOverride?: StyleOverrideSetter;
  openPickerKey?: string | null;
  setOpenPickerKey?: (key: string | null) => void;
};

interface EditableTextProps {
  as?: "h2" | "h3" | "p" | "div" | "span";
  className?: string;
  value: string;
  editable: boolean;
  onChange?: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  /** BB2: stable element id used to look up + write color overrides. */
  elementKey?: string;
  styleOverrides?: StyleOverrides;
  onStyleOverride?: StyleOverrideSetter;
  openPickerKey?: string | null;
  setOpenPickerKey?: (key: string | null) => void;
}

function EditableText({
  as: Tag = "p",
  className,
  value,
  editable,
  onChange,
  multiline = false,
  placeholder = "",
  elementKey,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // BB2: picker-open state lifted to the parent (InfographicStudio).
  // This element's picker is open iff openPickerKey matches its
  // elementKey. Lets the parent close every picker at once before
  // PNG capture (and keeps "only one picker open at a time" UX).
  const pickerOpen = !!elementKey && openPickerKey === elementKey;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // BB2: live override (or undefined → falls back to brand cascade).
  const override = elementKey ? styleOverrides?.[elementKey] : undefined;
  const colorStyle = override ? { color: override } : undefined;

  if (!editable) {
    return (
      <Tag className={className} style={colorStyle}>
        {value}
      </Tag>
    );
  }

  if (editing) {
    const commonProps = {
      autoFocus: true,
      ref: inputRef as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: () => {
        if (draft !== value) onChange?.(draft);
        setEditing(false);
      },
      placeholder,
      className: `${className ?? ""} ig-editable-input`,
      style: colorStyle,
    };
    if (multiline) {
      return (
        <textarea
          {...(commonProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={Math.max(2, draft.split("\n").length)}
        />
      );
    }
    return (
      <input
        {...(commonProps as React.InputHTMLAttributes<HTMLInputElement>)}
        type="text"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  // Blurred state. Wrap in a relative-positioned span so the BB2
  // palette button can absolute-anchor to the top-right edge of the
  // text without affecting layout. The wrapper is inline-block so it
  // sizes to content; the inner Tag keeps its block / inline behavior.
  return (
    <span className={`ig-editable-wrap${pickerOpen ? " ig-editable-wrap-open" : ""}`}>
      <Tag
        className={`${className ?? ""} ig-editable-blur`}
        style={colorStyle}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || <span className="ig-editable-placeholder">{placeholder}</span>}
      </Tag>
      {elementKey && onStyleOverride && setOpenPickerKey && (
        <ColorPicker
          open={pickerOpen}
          onToggle={() => setOpenPickerKey(pickerOpen ? null : elementKey)}
          onClose={() => setOpenPickerKey(null)}
          currentColor={override}
          onPick={(c) => {
            onStyleOverride(elementKey, c);
            setOpenPickerKey(null);
          }}
          onReset={() => {
            onStyleOverride(elementKey, null);
            setOpenPickerKey(null);
          }}
        />
      )}
    </span>
  );
}

// ─── ColorPicker ─────────────────────────────────────────────────────────────
//
// BB2: small popover with three options:
//   1. Reset to brand     (clears the override → falls back to cascade)
//   2. Brand-palette chips (curated 5-color BCG palette)
//   3. Custom hex picker  (HTML5 color input)
// The popover anchors to the top-right of its parent .ig-editable-wrap.
// Closes on outside click via a window-mousedown listener while open.

const BB2_BRAND_PALETTE: { name: string; hex: string }[] = [
  { name: "BCG Green",   hex: "#00723D" },
  { name: "BCG U Green", hex: "#00A651" },
  { name: "Teal",        hex: "#00857C" },
  { name: "Lime",        hex: "#A4D65E" },
  { name: "Deep Green",  hex: "#003B22" },
  { name: "Charcoal",    hex: "#1A1A1A" },
];

function ColorPicker({
  open,
  onToggle,
  onClose,
  currentColor,
  onPick,
  onReset,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  currentColor?: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open, onClose]);

  return (
    <span ref={wrapperRef} className="ig-color-picker-wrap">
      <button
        type="button"
        className={`ig-color-picker-trigger${open ? " ig-color-picker-trigger-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title="Set element color"
        aria-label="Set element color"
      >
        <span
          className="ig-color-picker-swatch"
          style={{ background: currentColor ?? "var(--brand-700, #00723D)" }}
        />
      </button>
      {open && (
        <div className="ig-color-picker-popover" onClick={(e) => e.stopPropagation()}>
          <div className="ig-color-picker-section">
            <button
              type="button"
              className="ig-color-picker-reset"
              onClick={onReset}
            >
              Reset to brand
            </button>
          </div>
          <div className="ig-color-picker-section">
            <div className="ig-color-picker-label">Brand palette</div>
            <div className="ig-color-picker-chips">
              {BB2_BRAND_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`ig-color-picker-chip${currentColor === c.hex ? " ig-color-picker-chip-active" : ""}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  onClick={() => onPick(c.hex)}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
          <div className="ig-color-picker-section">
            <label className="ig-color-picker-label">Custom</label>
            <input
              type="color"
              value={currentColor ?? "#00723D"}
              onChange={(e) => onPick(e.target.value)}
              className="ig-color-picker-hex"
            />
          </div>
        </div>
      )}
    </span>
  );
}

// ─── Style: Process ───────────────────────────────────────────────────────────

function ProcessLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  return (
    <div className="ig-process">
      {points.map((p, i) => (
        <div key={i} className="ig-process-item">
          <div className="ig-process-number">{i + 1}</div>
          <div className="ig-process-content">
            <div className="ig-process-heading-row">
              <Icon hint={p.iconHint} fallback="BusinessProcess" size={32} />
              <EditableText
                as="h3"
                className="ig-point-heading"
                elementKey={`point-${i}-heading`}
                value={p.heading}
                editable={editable}
                onChange={(v) => onPointChange?.(i, "heading", v)}
                placeholder="Step heading"
                styleOverrides={styleOverrides}
                onStyleOverride={onStyleOverride}
                openPickerKey={openPickerKey}
                setOpenPickerKey={setOpenPickerKey}
              />
            </div>
            <EditableText
              as="p"
              className="ig-point-body"
              elementKey={`point-${i}-body`}
              value={p.body}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "body", v)}
              multiline
              placeholder="Step description"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
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

function QuadrantLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
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
              <EditableText
                as="h3"
                className="ig-point-heading"
                elementKey={`point-${i}-heading`}
                value={p.heading || (editable ? "" : `Cell ${i + 1}`)}
                editable={editable}
                onChange={(v) => onPointChange?.(i, "heading", v)}
                placeholder={`Cell ${i + 1}`}
                styleOverrides={styleOverrides}
                onStyleOverride={onStyleOverride}
                openPickerKey={openPickerKey}
                setOpenPickerKey={setOpenPickerKey}
              />
            </div>
            <EditableText
              as="p"
              className="ig-point-body"
              elementKey={`point-${i}-body`}
              value={p.body}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "body", v)}
              multiline
              placeholder="Quadrant description"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
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

function ComparisonLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  // Comparison styles read best with 2-3 columns; clip if more.
  const cols = points.slice(0, 3);
  return (
    <div className="ig-comparison">
      {cols.map((p, i) => (
        <div key={i} className="ig-comparison-col">
          <div className="ig-comparison-header">
            <Icon hint={p.iconHint} fallback="CustomerInsight" size={44} />
            <EditableText
              as="h3"
              className="ig-point-heading-large"
              elementKey={`point-${i}-heading`}
              value={p.heading}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "heading", v)}
              placeholder="Column heading"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          </div>
          <EditableText
            as="p"
            className="ig-point-body"
            elementKey={`point-${i}-body`}
            value={p.body}
            editable={editable}
            onChange={(v) => onPointChange?.(i, "body", v)}
            multiline
            placeholder="Column description"
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
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

function NumberedListLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  return (
    <div className="ig-numbered-list">
      {points.map((p, i) => (
        <div key={i} className="ig-numbered-row">
          <div className="ig-numbered-large">{i + 1}</div>
          <div className="ig-numbered-content">
            <div className="ig-numbered-heading-row">
              <Icon hint={p.iconHint} fallback="FiveSteps" size={32} />
              <EditableText
                as="h3"
                className="ig-point-heading"
                elementKey={`point-${i}-heading`}
                value={p.heading}
                editable={editable}
                onChange={(v) => onPointChange?.(i, "heading", v)}
                placeholder="Item heading"
                styleOverrides={styleOverrides}
                onStyleOverride={onStyleOverride}
                openPickerKey={openPickerKey}
                setOpenPickerKey={setOpenPickerKey}
              />
            </div>
            <EditableText
              as="p"
              className="ig-point-body"
              elementKey={`point-${i}-body`}
              value={p.body}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "body", v)}
              multiline
              placeholder="Item description"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Style: Timeline ─────────────────────────────────────────────────────────

function TimelineLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  return (
    <div className="ig-timeline">
      <div className="ig-timeline-line" aria-hidden="true" />
      {points.map((p, i) => (
        <div key={i} className="ig-timeline-item">
          <div className="ig-timeline-marker">
            <Icon hint={p.iconHint} fallback="Clock" size={28} />
          </div>
          <div className="ig-timeline-content">
            <EditableText
              as="h3"
              className="ig-point-heading"
              elementKey={`point-${i}-heading`}
              value={p.heading}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "heading", v)}
              placeholder="Phase heading"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
            <EditableText
              as="p"
              className="ig-point-body"
              elementKey={`point-${i}-body`}
              value={p.body}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "body", v)}
              multiline
              placeholder="Phase description"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Style: Stat Spotlight ───────────────────────────────────────────────────
//
// Each point is a hero stat: heading reads as the BIG number / fact
// (e.g. "73%", "$2.1B", "10×"), body explains the context. Layout
// puts the heading in oversize gradient type so the eye lands on the
// number first, then drifts to the caption. The small accent rule on
// top of each cell ties into the brand cascade.

function StatSpotlightLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  return (
    <div className="ig-stat-spotlight">
      {points.map((p, i) => (
        <div key={i} className="ig-stat-cell">
          <div className="ig-stat-rule" aria-hidden="true" />
          <div className="ig-stat-icon">
            <Icon hint={p.iconHint} fallback={STAT_DEFAULTS[i % STAT_DEFAULTS.length]} size={28} />
          </div>
          <EditableText
            as="div"
            className="ig-stat-headline"
            elementKey={`point-${i}-heading`}
            value={p.heading}
            editable={editable}
            onChange={(v) => onPointChange?.(i, "heading", v)}
            placeholder="73%"
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
          <EditableText
            as="p"
            className="ig-stat-body"
            elementKey={`point-${i}-body`}
            value={p.body}
            editable={editable}
            onChange={(v) => onPointChange?.(i, "body", v)}
            multiline
            placeholder="Stat caption"
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
        </div>
      ))}
    </div>
  );
}

const STAT_DEFAULTS: BcgIconName[] = ["BarChart", "DataAnalysis", "Trophy", "Target", "Innovation"];

// ─── Style: Pyramid ──────────────────────────────────────────────────────────
//
// 3-5 levels stack from apex (most strategic) to base (most tactical).
// Each level is a trapezoid — top narrower than bottom — with the
// heading inside and the body floating to the right. The visual move
// is "vision narrows down to action": a classic LD framing.

function PyramidLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  // Pyramid reads cleanest with 3-5 levels. We accept the agent's count
  // as-is and let CSS scale the trapezoid widths via --pyramid-level
  // (computed inline below).
  const levels = points.slice(0, 5);
  const overflow = points.length - 5;
  const totalLevels = levels.length;

  return (
    <div className="ig-pyramid">
      <div className="ig-pyramid-stack">
        {levels.map((p, i) => {
          // Width scales linearly from 40% (apex, i=0) to 100% (base).
          // Narrow apex emphasizes the "few critical / many tactical"
          // visual. minWidth 40% keeps the apex readable even on a 3-
          // level pyramid.
          const span = totalLevels === 1
            ? 100
            : 40 + ((100 - 40) * i) / (totalLevels - 1);
          return (
            <div
              key={i}
              className="ig-pyramid-level"
              style={{ width: `${span}%` }}
            >
              <div className="ig-pyramid-level-inner">
                <div className="ig-pyramid-level-icon">
                  <Icon hint={p.iconHint} fallback={PYRAMID_DEFAULTS[i % PYRAMID_DEFAULTS.length]} size={26} />
                </div>
                <div className="ig-pyramid-level-text">
                  <div className="ig-pyramid-level-eyebrow">Level {totalLevels - i}</div>
                  <EditableText
                    as="h3"
                    className="ig-pyramid-level-heading"
                    elementKey={`point-${i}-heading`}
                    value={p.heading}
                    editable={editable}
                    onChange={(v) => onPointChange?.(i, "heading", v)}
                    placeholder="Level heading"
                    styleOverrides={styleOverrides}
                    onStyleOverride={onStyleOverride}
                    openPickerKey={openPickerKey}
                    setOpenPickerKey={setOpenPickerKey}
                  />
                </div>
              </div>
              <EditableText
                as="p"
                className="ig-pyramid-level-body"
                elementKey={`point-${i}-body`}
                value={p.body}
                editable={editable}
                onChange={(v) => onPointChange?.(i, "body", v)}
                multiline
                placeholder="Level description"
                styleOverrides={styleOverrides}
                onStyleOverride={onStyleOverride}
                openPickerKey={openPickerKey}
                setOpenPickerKey={setOpenPickerKey}
              />
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <div className="ig-overflow-note">
          +{overflow} additional level{overflow === 1 ? "" : "s"} not shown — pyramid fits 5
        </div>
      )}
    </div>
  );
}

// Apex (i=0) → base (i=4). Vision / Strategy / Plan / Execution / Measurement.
const PYRAMID_DEFAULTS: BcgIconName[] = ["Target", "Strategy", "BusinessProcess", "GroupCollaboration", "BarChart"];

// ─── Style: Cycle / Loop ─────────────────────────────────────────────────────
//
// Phases arranged around a center hub. The agent emits 4-6 phases;
// CSS positions them at evenly-spaced angles around a circle, with
// connector arrows showing flow direction. Center hub displays a
// summary glyph.

function CycleLayout({
  points,
  editable = false,
  onPointChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: { points: InfographicPoint[] } & LayoutEditableProps) {
  const phases = points.slice(0, 6);
  const overflow = points.length - 6;
  const n = phases.length;

  return (
    <div className="ig-cycle">
      <div className="ig-cycle-ring">
        {/* Center hub — pulses on hover, anchors the loop visually. */}
        <div className="ig-cycle-hub">
          <Icon hint="ContinuousTesting" fallback="ContinuousTesting" size={42} />
        </div>
        {phases.map((p, i) => {
          // Distribute phases around the circle starting at top (-90°)
          // going clockwise. CSS uses --angle to place each card via
          // transform: rotate(var(--angle)) translateY(-radius)
          // rotate(calc(var(--angle) * -1)).
          const angle = -90 + (360 * i) / n;
          return (
            <div
              key={i}
              className="ig-cycle-node"
              style={{ ["--angle" as unknown as string]: `${angle}deg` }}
            >
              <div className="ig-cycle-node-inner">
                <div className="ig-cycle-node-step">{i + 1}</div>
                <div className="ig-cycle-node-icon">
                  <Icon hint={p.iconHint} fallback={CYCLE_DEFAULTS[i % CYCLE_DEFAULTS.length]} size={22} />
                </div>
                <EditableText
                  as="h3"
                  className="ig-cycle-node-heading"
                  elementKey={`point-${i}-heading`}
                  value={p.heading}
                  editable={editable}
                  onChange={(v) => onPointChange?.(i, "heading", v)}
                  placeholder="Phase heading"
                  styleOverrides={styleOverrides}
                  onStyleOverride={onStyleOverride}
                  openPickerKey={openPickerKey}
                  setOpenPickerKey={setOpenPickerKey}
                />
                <EditableText
                  as="p"
                  className="ig-cycle-node-body"
                  elementKey={`point-${i}-body`}
                  value={p.body}
                  editable={editable}
                  onChange={(v) => onPointChange?.(i, "body", v)}
                  multiline
                  placeholder="Phase description"
                  styleOverrides={styleOverrides}
                  onStyleOverride={onStyleOverride}
                  openPickerKey={openPickerKey}
                  setOpenPickerKey={setOpenPickerKey}
                />
              </div>
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <div className="ig-overflow-note">
          +{overflow} additional phase{overflow === 1 ? "" : "s"} not shown — cycle fits 6
        </div>
      )}
    </div>
  );
}

const CYCLE_DEFAULTS: BcgIconName[] = ["MagnifyingGlass", "BrainNetwork", "Strategy", "BusinessProcess", "BetaTest", "Survey"];

// ─── Style: Five Forces ──────────────────────────────────────────────────────
//
// Porter-style: a central concept (the infographic title) surrounded
// by 4-5 forces in cardinal positions (top / right / bottom / left /
// optional center-second). 5 points = 5 forces; we display all in a
// cross layout with the title in the middle disc.

function FiveForcesLayout({
  points,
  title,
  subtitle,
  editable = false,
  onPointChange,
  onTitleChange,
  onSubtitleChange,
  styleOverrides,
  onStyleOverride,
  openPickerKey,
  setOpenPickerKey,
}: {
  points: InfographicPoint[];
  title: string;
  subtitle: string;
  editable?: boolean;
  onPointChange?: PointChangeHandler;
  onTitleChange?: (v: string) => void;
  onSubtitleChange?: (v: string) => void;
  styleOverrides?: StyleOverrides;
  onStyleOverride?: StyleOverrideSetter;
  openPickerKey?: string | null;
  setOpenPickerKey?: (key: string | null) => void;
}) {
  const forces = points.slice(0, 5);
  const overflow = points.length - 5;
  // Position labels for the cross layout — the agent emits in any
  // order; we fill positions clockwise from top: top, right, bottom,
  // left, then a 5th in the bottom-right diagonal slot.
  const positions = ["top", "right", "bottom", "left", "diag"];

  return (
    <div className="ig-five-forces">
      <div className="ig-five-forces-grid">
        <div className="ig-five-forces-center">
          <div className="ig-five-forces-center-eyebrow">Central question</div>
          <EditableText
            as="h2"
            className="ig-five-forces-center-title"
            elementKey="title"
            value={title}
            editable={editable}
            onChange={onTitleChange}
            placeholder="Central question"
            styleOverrides={styleOverrides}
            onStyleOverride={onStyleOverride}
            openPickerKey={openPickerKey}
            setOpenPickerKey={setOpenPickerKey}
          />
          {(subtitle || editable) && (
            <EditableText
              as="p"
              className="ig-five-forces-center-subtitle"
              elementKey="subtitle"
              value={subtitle}
              editable={editable}
              onChange={onSubtitleChange}
              placeholder="Optional context"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          )}
        </div>
        {forces.map((p, i) => (
          <div
            key={i}
            className={`ig-five-forces-node ig-five-forces-node-${positions[i] || "diag"}`}
          >
            <div className="ig-five-forces-node-icon">
              <Icon hint={p.iconHint} fallback={FORCES_DEFAULTS[i % FORCES_DEFAULTS.length]} size={26} />
            </div>
            <EditableText
              as="h3"
              className="ig-five-forces-node-heading"
              elementKey={`point-${i}-heading`}
              value={p.heading}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "heading", v)}
              placeholder="Force name"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
            <EditableText
              as="p"
              className="ig-five-forces-node-body"
              elementKey={`point-${i}-body`}
              value={p.body}
              editable={editable}
              onChange={(v) => onPointChange?.(i, "body", v)}
              multiline
              placeholder="Force description"
              styleOverrides={styleOverrides}
              onStyleOverride={onStyleOverride}
              openPickerKey={openPickerKey}
              setOpenPickerKey={setOpenPickerKey}
            />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="ig-overflow-note">
          +{overflow} additional force{overflow === 1 ? "" : "s"} not shown — five forces fits 5
        </div>
      )}
    </div>
  );
}

const FORCES_DEFAULTS: BcgIconName[] = ["GroupCollaboration", "CustomerInsight", "Innovation", "Coach", "Alert"];

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
