import type { ComponentRegistryEntry } from "../types";

export const HTML_COMPS: ComponentRegistryEntry[] = [
  { id: "highlight", n: "Banner",         d: "Full-width gradient header banner",       ic: "★",  cat: "layout"  },
  { id: "callout",   n: "Callout",        d: "Info, tip, warning or success box",       ic: "!",  cat: "content" },
  { id: "quote",     n: "Blockquote",     d: "Pull quote with green accent bar",        ic: "❝",  cat: "content" },
  { id: "divider",   n: "Divider",        d: "Labeled section separator",               ic: "—",  cat: "layout"  },
  { id: "table",     n: "Table",          d: "Green header with alternating rows",      ic: "▦",  cat: "data"    },
  { id: "compare",   n: "Comparison",     d: "Side-by-side two-column comparison",      ic: "⇔",  cat: "data"    },
  { id: "glossary",  n: "Glossary",       d: "Term–definition pairs",                   ic: "Aa", cat: "data"    },
  { id: "cards",     n: "Cards",          d: "2–3 content cards side by side",          ic: "▦",  cat: "layout"  },
  { id: "columns",   n: "Columns",        d: "Multi-column text layout",                ic: "║",  cat: "layout"  },
  { id: "process",   n: "Process",        d: "Numbered steps in a row",                 ic: "→",  cat: "layout"  },
  { id: "stats",     n: "Statistics",     d: "Big numbers with labels",                 ic: "#",  cat: "data"    },
  { id: "iconrow",   n: "Icons",          d: "Symbol icons with labels in a row",       ic: "●",  cat: "layout"  },
  { id: "timeline",  n: "Timeline",       d: "Vertical timeline with dots",             ic: "│",  cat: "content" },
  { id: "numbered",  n: "Numbered list",  d: "Green numbered items with descriptions",  ic: "1.", cat: "content" },
  { id: "checklist", n: "Checklist",      d: "Green checkmark list",                    ic: "✓",  cat: "content" },
  { id: "progress",  n: "Progress bar",   d: "Stage completion tracker",                ic: "━",  cat: "layout"  },
  { id: "keypoints", n: "Key Takeaways",  d: "Highlighted bullet summary box",          ic: "★",  cat: "content" },
  { id: "faq",       n: "FAQ",            d: "Question & answer pairs",                 ic: "?",  cat: "content" },
  { id: "twostat",   n: "Stat Highlight", d: "One big stat with supporting text",       ic: "#",  cat: "data"    },
  { id: "badge",     n: "Label Badges",   d: "Colored pill tags — skills, topics",      ic: "◉",  cat: "layout"  },
];

export const SCORM_COMPS: ComponentRegistryEntry[] = [
  { id: "s_flipcard",   n: "Flip cards",           d: "Click cards to flip and reveal back content",   ic: "↻",  cat: "interactive" },
  { id: "s_accordion",  n: "Accordion",            d: "Click to expand/collapse sections",             ic: "▼",  cat: "interactive" },
  { id: "s_tabs",       n: "Tabs",                 d: "Switch between tabbed content panels",          ic: "▭",  cat: "interactive" },
  { id: "s_reveal",     n: "Click to reveal",      d: "Hidden content revealed behind buttons",        ic: "◉",  cat: "interactive" },
  { id: "s_stepper",    n: "Step by step",         d: "Navigate through steps with next/prev",         ic: "→",  cat: "interactive" },
  { id: "s_stacked",    n: "Stacked cards",        d: "Overlapping cards, click to expand",            ic: "▣",  cat: "interactive" },
  { id: "s_cycle",      n: "Cycle diagram",        d: "Circular process with click-to-expand nodes",   ic: "⟳",  cat: "interactive" },
  { id: "s_timeline_i", n: "Interactive timeline", d: "Click timeline points for details",             ic: "│",  cat: "interactive" },
  { id: "s_sort",       n: "Drag to sort",         d: "Drag items into the correct order",             ic: "↕",  cat: "assessment"  },
  { id: "s_match",      n: "Matching",             d: "Match terms with definitions",                  ic: "⇄",  cat: "assessment"  },
  { id: "s_quiz",       n: "Multiple Choice",      d: "Question with 4 options and instant feedback",  ic: "?",  cat: "assessment"  },
  { id: "s_poll",       n: "Opinion Poll",         d: "Vote and see animated bar chart results",       ic: "📊", cat: "assessment"  },
];
