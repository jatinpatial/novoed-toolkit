/**
 * Track-HH: themed cover image library.
 *
 * Replaces the runtime Pexels round-trip for project covers with a
 * curated set of 12 Unsplash-hosted images keyed by theme. Each LD
 * project (course / KC / infographic / script) gets a cover picked
 * automatically from its title + description via pickThemedCover();
 * the LD can override per-project via the picker UI.
 *
 * Why themed covers vs. live Pexels:
 *   - Pexels requires an API key configured in .env on each LD's
 *     laptop. Pilot LDs aren't always set up; the themed library
 *     works out of the box.
 *   - Pexels results vary per query — same project name on two
 *     machines could return different photos. Themed covers are
 *     deterministic.
 *   - 12 images are enough variety for the pilot; the per-project
 *     picker has a "Search Pexels for more…" escape hatch when an
 *     LD wants something specific.
 *
 * Local-file upgrade path: replace the THEMED_COVER_URLS Unsplash
 * URLs with `/themed-covers/<theme>.jpg` paths and drop the JPEGs
 * into app/public/themed-covers/. The runtime behavior is identical;
 * local files cut the Unsplash CDN dependency.
 */

export type CoverTheme =
  | "leadership"
  | "feedback"
  | "strategy"
  | "collaboration"
  | "communication"
  | "learning"
  | "innovation"
  | "change"
  | "data"
  | "team"
  | "corporate"
  | "default";

const THEME_KEYWORDS: Record<Exclude<CoverTheme, "default">, string[]> = {
  // Order matters — more specific themes are checked before generic
  // ones so "feedback" doesn't accidentally match a "leadership"
  // course just because both contain "manager".
  leadership: ["leader", "manager", "executive", "director", "lead", "ceo", "vp"],
  feedback: ["feedback", "1:1", "1-on-1", "review", "performance", "coaching"],
  strategy: ["strategy", "strategic", "planning", "vision", "roadmap", "framework"],
  collaboration: ["team", "collaboration", "cross-functional", "teamwork", "stakeholder"],
  communication: ["communication", "presentation", "speaking", "writing", "storytelling"],
  learning: ["learning", "training", "skill", "development", "onboarding", "education"],
  innovation: ["innovation", "tech", "ai", "digital", "transformation", "creative"],
  change: ["change", "restructuring", "transition", "shift", "reorganization"],
  data: ["data", "analytics", "metrics", "kpi", "dashboard", "insight"],
  team: ["team", "diverse", "group", "people", "cohort"],
  corporate: ["corporate", "business", "professional", "office", "enterprise"],
};

/**
 * Curated cover paths per theme — one local JPG per theme, served
 * from the Vite public/ folder at <BASE_URL>themed-covers/<theme>.jpg.
 *
 * Local-first hosting (vs. Unsplash CDN hotlinks) so the pilot LDs
 * don't depend on the CDN being reachable from inside the BCG
 * network or the Unsplash URL staying stable. Files were downloaded
 * once and committed alongside the codebase; total bundle weight is
 * ~2.4 MB across the 12 images.
 *
 * Picked for: clean composition, neutral lighting (so the brand
 * gradient overlay reads consistently), no recognizable faces /
 * logos (avoids surprise releases / IP issues).
 */
const BASE = import.meta.env.BASE_URL;
const themedPath = (slug: string): string => `${BASE}themed-covers/${slug}.jpg`;

export const THEMED_COVER_URLS: Record<CoverTheme, string> = {
  leadership: themedPath("leadership"),
  feedback: themedPath("feedback"),
  strategy: themedPath("strategy"),
  collaboration: themedPath("collaboration"),
  communication: themedPath("communication"),
  learning: themedPath("learning"),
  innovation: themedPath("innovation"),
  change: themedPath("change"),
  data: themedPath("data"),
  team: themedPath("team"),
  corporate: themedPath("corporate"),
  default: themedPath("default"),
};

/** Human-readable names for the picker UI. */
export const THEME_LABELS: Record<CoverTheme, string> = {
  leadership: "Leadership",
  feedback: "Feedback / 1:1s",
  strategy: "Strategy",
  collaboration: "Collaboration",
  communication: "Communication",
  learning: "Learning & Training",
  innovation: "Innovation",
  change: "Change & Transformation",
  data: "Data & Analytics",
  team: "Team",
  corporate: "Corporate",
  default: "Default",
};

/**
 * Pick the best-matching theme for a piece of text (typically the
 * project title + optional description / topic). Case-insensitive
 * substring match; first hit in THEME_KEYWORDS order wins.
 *
 * Returns "default" when no theme matches — the default cover is a
 * generic professional scene that works for any topic.
 */
export function pickTheme(text: string): CoverTheme {
  const lower = text.toLowerCase();
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [
    Exclude<CoverTheme, "default">,
    string[],
  ][]) {
    if (keywords.some((k) => lower.includes(k))) return theme;
  }
  return "default";
}

/** Convenience: map text → URL in one call. Used by project save
 *  paths so the cover lands on the record at creation time. */
export function pickThemedCoverUrl(text: string): string {
  return THEMED_COVER_URLS[pickTheme(text)];
}
