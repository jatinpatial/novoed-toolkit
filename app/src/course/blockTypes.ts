import type { BlockData, BlockType } from "./types";

export const BTYPES: BlockType[] = [
  { id: "text",      label: "Text",       icon: "T",  col: "#6366f1" },
  { id: "video",     label: "Video",      icon: "▶",  col: "#ef4444" },
  { id: "image",     label: "Image",      icon: "🖼", col: "#f59e0b" },
  { id: "banner",    label: "Banner",     icon: "◼",  col: "#29BA74" },
  { id: "callout",   label: "Callout",    icon: "ℹ",  col: "#29BA74" },
  { id: "cards",     label: "Cards",      icon: "⊞",  col: "#29BA74" },
  { id: "stats",     label: "Stats",      icon: "#",  col: "#197A56" },
  { id: "accordion", label: "Accordion",  icon: "☰",  col: "#8b5cf6" },
  { id: "flipcard",  label: "Flip Cards", icon: "↺",  col: "#8b5cf6" },
  { id: "timeline",  label: "Timeline",   icon: "↓",  col: "#8b5cf6" },
  { id: "quiz",      label: "Quiz",       icon: "?",  col: "#f59e0b" },
  { id: "poll",      label: "Poll",       icon: "📊", col: "#f59e0b" },
  { id: "divider",   label: "Divider",    icon: "—",  col: "#94a3b8" },
];

export const BDEFAULTS: Record<string, BlockData> = {
  text:      { content: "Add your content here. Double-click to edit." },
  video:     { url: "", caption: "" },
  image:     { url: "", caption: "" },
  banner:    { title: "Key Insight", body: "Add your key message here." },
  callout:   { type: "tip", body: "Add your tip or important note here." },
  cards:     { items: [{ title: "Point 1", desc: "Description here" }, { title: "Point 2", desc: "Description here" }, { title: "Point 3", desc: "Description here" }] },
  stats:     { items: [{ title: "87%", desc: "Metric label" }, { title: "3.5×", desc: "Metric label" }, { title: "2.7×", desc: "Metric label" }] },
  accordion: { title: "", body: "", items: [{ title: "Section 1", desc: "Content here" }, { title: "Section 2", desc: "Content here" }, { title: "Section 3", desc: "Content here" }] },
  flipcard:  { title: "", body: "", items: [{ title: "Card 1", img: "", desc: "Flip side content" }, { title: "Card 2", img: "", desc: "Flip side content" }, { title: "Card 3", img: "", desc: "Flip side content" }] },
  timeline:  { items: [{ title: "Step 1", desc: "Description" }, { title: "Step 2", desc: "Description" }, { title: "Step 3", desc: "Description" }, { title: "Step 4", desc: "Description" }] },
  quiz:      { title: "Knowledge Check", body: "", items: [{ title: "What is the question?" }, { title: "Option A", desc: "0" }, { title: "Option B", desc: "1" }, { title: "Option C", desc: "0" }, { title: "Option D", desc: "0" }] },
  poll:      { title: "Quick Poll", body: "", items: [{ title: "Option 1", desc: "25" }, { title: "Option 2", desc: "25" }, { title: "Option 3", desc: "25" }, { title: "Option 4", desc: "25" }] },
  divider:   { title: "" },
};

export function newItemForBlock(type: string): BlockData["items"] extends (infer U)[] | undefined ? U : never {
  if (type === "quiz") return { title: "New option", desc: "0" };
  if (type === "poll") return { title: "New option", desc: "25" };
  if (type === "flipcard") return { title: "New card", img: "", desc: "Flip side content" };
  return { title: "New item", desc: "" };
}
