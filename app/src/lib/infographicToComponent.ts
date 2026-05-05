/**
 * Track-SS (Deckster v2): Infographic → Component Library transformer.
 *
 * Maps an Infographic record (style + points[]) to the existing
 * NovoEd Component Library data shape so the user can export the
 * same content as:
 *   - Static HTML embed (Froala-paste into NovoEd)            via genHTML
 *   - Standalone interactive HTML (SCORM-ready)               via genSCORMhtml
 *
 * The PNG output stays on the existing InfographicRenderer path.
 *
 * Style mapping is opinionated — we pick the SINGLE component that
 * best preserves the meaning of the original layout. If the LD
 * disagrees, the regular Infographic renderer + PNG export remains
 * available, and they can hand-pick a component in the legacy
 * Component Library page.
 *
 * Mapping rationale (per row):
 *   process        → static `process` (numbered row), interactive `s_stepper`
 *                    (next/prev) — both preserve sequential ordering
 *   numbered_list  → static `numbered`, interactive `s_accordion` — list
 *                    semantics on both sides; accordion adds reveal
 *   timeline       → static `timeline`, interactive `s_timeline_i` — same
 *                    metaphor, the i-variant adds click-for-detail
 *   cycle          → static falls back to `iconrow` (closest visual to
 *                    a circle in static), interactive `s_cycle`
 *   pyramid        → static falls back to `numbered` (vertical hierarchy
 *                    reads as ranking), interactive `s_stacked`
 *   comparison     → static `compare` (2 cols), interactive `s_tabs`
 *   quadrant       → static falls back to `cards`, interactive `s_flipcard`
 *                    (4 cards mirror 4 quadrants visually)
 *   five_forces    → static `iconrow` (5 in a row preserves Porter's
 *                    spoke metaphor), interactive `s_reveal`
 *   stat_spotlight → static `stats`, interactive falls back to `s_flipcard`
 */

import type { InfographicPoint, InfographicStyle } from "../store/infographics";
import type { ComponentData, ComponentItem } from "../types";

export interface InfographicTransform {
  /** Component id used by genHTML for static-embed output. */
  htmlComponentId: string;
  /** Component id used by genSCORMhtml for interactive output. */
  scormComponentId: string;
  /** V3: alternate static components the LD can swap to without
   *  re-running the agent. UI surfaces these in a "Switch template"
   *  dropdown on the InfographicStudio result page. */
  htmlAlternates: string[];
  /** V3: alternate interactive components. */
  scormAlternates: string[];
  /** Shared data payload — same for both static and interactive. */
  data: ComponentData;
}

/**
 * V3: each style now exposes a PRIMARY component plus alternates so
 * the LD can switch on the result page without re-running the agent.
 * Brings in much more of the NovoEd toolkit (20 HTML + 12 SCORM)
 * than the original v2 mapping (which used only 9 of each).
 *
 * The PRIMARY is the default render. ALTERNATES are valid swaps the
 * LD can pick from a "Switch template" dropdown — e.g. a numbered_list
 * infographic can render as `numbered` (default), `keypoints`
 * (highlighted summary box), `checklist`, or `faq` if Q&A-shaped.
 */
const STYLE_TO_HTML_PRIMARY: Record<InfographicStyle, string> = {
  process:        "process",
  numbered_list:  "numbered",
  timeline:       "timeline",
  cycle:          "iconrow",
  pyramid:        "numbered",
  comparison:     "compare",
  quadrant:       "cards",
  five_forces:    "iconrow",
  stat_spotlight: "stats",
};

const STYLE_TO_HTML_ALTERNATES: Record<InfographicStyle, string[]> = {
  process:        ["process", "numbered", "checklist", "timeline"],
  numbered_list:  ["numbered", "keypoints", "checklist", "faq", "iconrow"],
  timeline:       ["timeline", "process", "numbered"],
  cycle:          ["iconrow", "process", "numbered", "cards"],
  pyramid:        ["numbered", "keypoints", "stats"],
  comparison:     ["compare", "table", "cards", "columns"],
  quadrant:       ["cards", "compare", "iconrow"],
  five_forces:    ["iconrow", "cards", "numbered"],
  stat_spotlight: ["stats", "twostat", "keypoints"],
};

const STYLE_TO_SCORM_PRIMARY: Record<InfographicStyle, string> = {
  process:        "s_stepper",
  numbered_list:  "s_accordion",
  timeline:       "s_timeline_i",
  cycle:          "s_cycle",
  pyramid:        "s_stacked",
  comparison:     "s_tabs",
  quadrant:       "s_flipcard",
  five_forces:    "s_reveal",
  stat_spotlight: "s_flipcard",
};

const STYLE_TO_SCORM_ALTERNATES: Record<InfographicStyle, string[]> = {
  process:        ["s_stepper", "s_timeline_i", "s_accordion"],
  numbered_list:  ["s_accordion", "s_reveal", "s_flipcard", "s_stacked"],
  timeline:       ["s_timeline_i", "s_stepper", "s_cycle"],
  cycle:          ["s_cycle", "s_stepper", "s_reveal"],
  pyramid:        ["s_stacked", "s_accordion", "s_reveal"],
  comparison:     ["s_tabs", "s_flipcard", "s_match"],
  quadrant:       ["s_flipcard", "s_tabs", "s_reveal"],
  five_forces:    ["s_reveal", "s_flipcard", "s_cycle"],
  stat_spotlight: ["s_flipcard", "s_reveal", "s_stepper"],
};

// Backwards-compat exports (old code paths read STYLE_TO_HTML directly).
export const STYLE_TO_HTML = STYLE_TO_HTML_PRIMARY;
export const STYLE_TO_SCORM = STYLE_TO_SCORM_PRIMARY;

/**
 * Transform an Infographic record into the component library's data
 * shape. Caller hands us the resolved title + subtitle + points and
 * the layout style.
 */
export function infographicToComponent(args: {
  title: string;
  subtitle: string;
  style: InfographicStyle;
  points: InfographicPoint[];
}): InfographicTransform {
  const { title, subtitle, style, points } = args;

  // Map points → ComponentItem[]. The component library's items
  // expect { title, desc, icon, img }; an iconHint of "photo:<query>"
  // signals a Pexels image (handled by the renderer when ready),
  // anything else is treated as a glyph hint.
  const items: ComponentItem[] = points.map((p, i) => {
    const iconHint = (p.iconHint || "").trim();
    const isPhoto = iconHint.toLowerCase().startsWith("photo:");
    const item: ComponentItem = {
      title: p.heading || `Point ${i + 1}`,
      desc: p.body || "",
    };
    if (isPhoto) {
      // Strip "photo:" prefix; downstream treats as a search hint.
      // The component library's genHTML/genSCORMhtml expects an actual
      // URL in `img`; for now we leave the field unset and let the
      // glyph fallback render. (Wiring photo URLs through is its own
      // task — see Track-RR queue.)
      item.icon = String(i + 1).padStart(2, "0");
    } else if (iconHint) {
      // Use first 2 chars of the BCG icon name as a glyph fallback,
      // or the raw hint if it looks like a single character / emoji.
      item.icon = iconHint.length <= 2 ? iconHint : String(i + 1).padStart(2, "0");
    } else {
      item.icon = String(i + 1).padStart(2, "0");
    }
    return item;
  });

  // Pick the right id per format. Default fallbacks if style is
  // somehow unknown (shouldn't happen — InfographicStyle is a sealed
  // union).
  const htmlComponentId = STYLE_TO_HTML_PRIMARY[style] || "numbered";
  const scormComponentId = STYLE_TO_SCORM_PRIMARY[style] || "s_accordion";
  const htmlAlternates = STYLE_TO_HTML_ALTERNATES[style] || [htmlComponentId];
  const scormAlternates = STYLE_TO_SCORM_ALTERNATES[style] || [scormComponentId];

  // Special-case stat_spotlight for static — the `stats` component
  // expects items with `desc` containing the big number. If the
  // points have numbers in their headings or bodies, surface them.
  // Keep simple for v1: pass title as-is, let the agent supply the
  // big-number formatting in `heading`.

  const data: ComponentData = {
    title,
    body: subtitle,
    items,
  };

  return { htmlComponentId, scormComponentId, htmlAlternates, scormAlternates, data };
}
