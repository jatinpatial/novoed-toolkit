import type { BlockData, BlockType } from "./types";

/**
 * BTYPES — the catalog of block types Lesson Writer v2 (AI-1b/c) and the
 * LD's manual block-picker can reach for. Each entry pairs a stable id
 * (used in tool calls + storage), a display label, an icon glyph for
 * the picker grid, and a category color for the picker chip.
 *
 * AI-1b additions:
 *   - quote            attributed pull quote (photo + author + role)
 *   - clickInstruction italic green hint above an interactive
 *   - sectionHeader    icon-circle + title divider for section identity
 *
 * Existing types unchanged. The banner block was extended to support
 * an optional imageUrl for "statement" treatment (no new type).
 */
export const BTYPES: BlockType[] = [
  { id: "text",             label: "Text",             icon: "T",  col: "#6366f1" },
  { id: "video",            label: "Video",            icon: "▶",  col: "#ef4444" },
  { id: "image",            label: "Image",            icon: "🖼", col: "#f59e0b" },
  { id: "banner",           label: "Banner",           icon: "◼",  col: "#29BA74" },
  { id: "callout",          label: "Callout",          icon: "ℹ",  col: "#29BA74" },
  { id: "quote",            label: "Quote",            icon: "❝",  col: "#29BA74" },
  { id: "clickInstruction", label: "Click hint",       icon: "→",  col: "#29BA74" },
  { id: "sectionHeader",    label: "Section header",   icon: "§",  col: "#29BA74" },
  { id: "cards",            label: "Cards",            icon: "⊞",  col: "#29BA74" },
  { id: "stats",             label: "Stats",            icon: "#",  col: "#197A56" },
  { id: "accordion",        label: "Accordion",        icon: "☰",  col: "#8b5cf6" },
  { id: "flipcard",         label: "Flip Cards",       icon: "↺",  col: "#8b5cf6" },
  { id: "timeline",         label: "Timeline",         icon: "↓",  col: "#8b5cf6" },
  { id: "quiz",             label: "Quiz",             icon: "?",  col: "#f59e0b" },
  { id: "poll",             label: "Poll",             icon: "📊", col: "#f59e0b" },
  { id: "divider",          label: "Divider",          icon: "—",  col: "#94a3b8" },
];

/**
 * SECTION_ICON_NAMES — curated icon vocabulary for sectionHeader
 * blocks. The agent's prompt references this exact set (AI-1c) so it
 * can't reach for icons outside the curated 12. The renderer maps each
 * name to a lucide-react icon component; unknown names fall back to
 * BookOpen.
 *
 * Picked for the BCG U editorial vocabulary:
 *   target        Objectives / what learners will be able to do
 *   brain         Concepts / Mental models / "Why this matters"
 *   pencil        Apply / Write / Practice
 *   quote         Stakeholder voice / Reflection prompts
 *   check         Key takeaways / Review / What you've learned
 *   clock         Expected time / Pacing / Timeline-adjacent
 *   lightbulb     Insights / Pro tips / Aha moments
 *   bookOpen      Source materials / Further reading / References
 *   sparkles      Highlights / What's new / Agent-suggested moments
 *   alertCircle   Note / Caveats / Important considerations
 *   trendingUp    Why it matters / Impact / Data-forward sections
 *   users         Stakeholders / Audience / Roles
 */
export const SECTION_ICON_NAMES = [
  "target",
  "brain",
  "pencil",
  "quote",
  "check",
  "clock",
  "lightbulb",
  "bookOpen",
  "sparkles",
  "alertCircle",
  "trendingUp",
  "users",
] as const;

export type SectionIconName = (typeof SECTION_ICON_NAMES)[number];

export const BDEFAULTS: Record<string, BlockData> = {
  text:             { content: "Add your content here. Double-click to edit." },
  video:            { url: "", caption: "" },
  image:            { url: "", caption: "" },
  banner:           { title: "Key Insight", body: "Add your key message here." },
  callout:          { type: "tip", body: "Add your tip or important note here." },
  quote:            { body: "A direct quote from a stakeholder, expert, or source.", attribution: "Author Name", attributionRole: "Role, Company" },
  clickInstruction: { content: "Click each card to reveal the answer." },
  sectionHeader:    { title: "Section Title", iconName: "bookOpen" },
  cards:            { items: [{ title: "Point 1", desc: "Description here" }, { title: "Point 2", desc: "Description here" }, { title: "Point 3", desc: "Description here" }] },
  stats:            { items: [{ title: "87%", desc: "Metric label" }, { title: "3.5×", desc: "Metric label" }, { title: "2.7×", desc: "Metric label" }] },
  accordion:        { title: "", body: "", items: [{ title: "Section 1", desc: "Content here" }, { title: "Section 2", desc: "Content here" }, { title: "Section 3", desc: "Content here" }] },
  flipcard:         { title: "", body: "", items: [{ title: "Card 1", img: "", desc: "Flip side content" }, { title: "Card 2", img: "", desc: "Flip side content" }, { title: "Card 3", img: "", desc: "Flip side content" }] },
  timeline:         { items: [{ title: "Step 1", desc: "Description" }, { title: "Step 2", desc: "Description" }, { title: "Step 3", desc: "Description" }, { title: "Step 4", desc: "Description" }] },
  quiz:             { title: "Knowledge Check", body: "", items: [{ title: "What is the question?" }, { title: "Option A", desc: "0" }, { title: "Option B", desc: "1" }, { title: "Option C", desc: "0" }, { title: "Option D", desc: "0" }] },
  poll:             { title: "Quick Poll", body: "", items: [{ title: "Option 1", desc: "25" }, { title: "Option 2", desc: "25" }, { title: "Option 3", desc: "25" }, { title: "Option 4", desc: "25" }] },
  divider:          { title: "" },
};

export function newItemForBlock(type: string): BlockData["items"] extends (infer U)[] | undefined ? U : never {
  if (type === "quiz") return { title: "New option", desc: "0" };
  if (type === "poll") return { title: "New option", desc: "25" };
  if (type === "flipcard") return { title: "New card", img: "", desc: "Flip side content" };
  return { title: "New item", desc: "" };
}
