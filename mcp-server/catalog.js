// Component catalog — mirror of HTML_COMPS + SCORM_COMPS + DEFAULTS + PROMPTS
// from ../index.html. Kept hand-maintained (small surface) so the MCP server can
// run standalone without parsing the toolkit file at startup.
//
// When adding a new component to index.html:
//   1) add its entry under HTML_COMPS or SCORM_COMPS in this file
//   2) add a DEFAULTS example
//   3) add a PROMPTS template
// The MCP server's list_components tool uses these four objects.

export const HTML_COMPS = [
  { id: "highlight", n: "Banner",          d: "Full-width gradient header banner",            cat: "layout"    },
  { id: "callout",   n: "Callout",         d: "Info, tip, warning or success box",             cat: "text"      },
  { id: "quote",     n: "Blockquote",      d: "Pull quote with accent bar",                    cat: "text"      },
  { id: "divider",   n: "Divider",         d: "Labeled section separator",                     cat: "layout"    },
  { id: "keypoints", n: "Key Takeaways",   d: "Highlighted bullet summary box",                cat: "text"      },
  { id: "faq",       n: "FAQ",             d: "Question & answer pairs",                       cat: "text"      },
  { id: "numbered",  n: "Numbered list",   d: "Numbered items with descriptions",              cat: "text"      },
  { id: "checklist", n: "Checklist",       d: "Green checkmark list",                          cat: "text"      },
  { id: "glossary",  n: "Glossary",        d: "Term–definition pairs",                         cat: "text"      },
  { id: "cards",     n: "Cards",           d: "2–3 content cards side by side",                cat: "layout"    },
  { id: "columns",   n: "Columns",         d: "Multi-column text layout",                      cat: "layout"    },
  { id: "process",   n: "Process",         d: "Numbered steps in a row",                       cat: "layout"    },
  { id: "iconrow",   n: "Icons",           d: "Symbol icons with labels in a row",             cat: "layout"    },
  { id: "timeline",  n: "Timeline",        d: "Vertical timeline with dots",                   cat: "layout"    },
  { id: "progress",  n: "Progress bar",    d: "Stage completion tracker",                      cat: "layout"    },
  { id: "badge",     n: "Label Badges",    d: "Colored pill tags — skills, topics",            cat: "layout"    },
  { id: "table",     n: "Table",           d: "Header row with alternating rows",              cat: "data"      },
  { id: "compare",   n: "Comparison",      d: "Side-by-side two-column comparison",            cat: "data"      },
  { id: "stats",     n: "Statistics",      d: "Big numbers with labels",                       cat: "data"      },
  { id: "twostat",   n: "Stat Highlight",  d: "One big stat with supporting text",             cat: "data"      },
  { id: "kpi",       n: "KPI Dashboard",   d: "Metric tiles with trend indicators",            cat: "data"      },
  { id: "donut",     n: "Donut Chart",     d: "Ring chart with legend for proportions",        cat: "data"      },
  { id: "bar",       n: "Bar Chart",       d: "Horizontal bars with labels and values",        cat: "data"      },
  { id: "matrix",    n: "2×2 Matrix",      d: "Strategic quadrant matrix (BCG-style)",         cat: "framework" },
  { id: "swot",      n: "SWOT Analysis",   d: "Strengths, Weaknesses, Opportunities, Threats", cat: "framework" },
  { id: "pyramid",   n: "Pyramid",         d: "Tiered pyramid hierarchy",                      cat: "framework" },
  { id: "funnel",    n: "Funnel",          d: "Top-down conversion or filter funnel",          cat: "framework" },
  { id: "proscons",  n: "Pros & Cons",     d: "Two-column pros vs cons list",                  cat: "framework" },
  { id: "dodont",    n: "Do's & Don'ts",   d: "Best practice vs anti-pattern list",            cat: "framework" },
  { id: "roadmap",   n: "Roadmap",         d: "Phased horizontal chevron roadmap",             cat: "framework" },
  { id: "aiprompt",  n: "AI Prompt Block", d: "Copy-ready AI prompt in a styled code block",   cat: "text"      }
];

export const SCORM_COMPS = [
  { id: "s_flipcard",   n: "Flip cards",           d: "Click cards to flip and reveal back content",     cat: "interactive" },
  { id: "s_accordion",  n: "Accordion",            d: "Click to expand/collapse sections",               cat: "interactive" },
  { id: "s_tabs",       n: "Tabs",                 d: "Switch between tabbed content panels",            cat: "interactive" },
  { id: "s_reveal",     n: "Click to reveal",      d: "Hidden content revealed behind buttons",          cat: "interactive" },
  { id: "s_stepper",    n: "Step by step",         d: "Navigate through steps with next/prev",           cat: "interactive" },
  { id: "s_stacked",    n: "Stacked cards",        d: "Overlapping cards, click to expand",              cat: "interactive" },
  { id: "s_cycle",      n: "Cycle diagram",        d: "Circular process with click-to-expand nodes",     cat: "interactive" },
  { id: "s_timeline_i", n: "Interactive timeline", d: "Click timeline points for details",               cat: "interactive" },
  { id: "s_sort",       n: "Drag to sort",         d: "Drag items into the correct order",               cat: "assessment"  },
  { id: "s_match",      n: "Matching",             d: "Match terms with definitions",                    cat: "assessment"  },
  { id: "s_quiz",       n: "Multiple Choice",      d: "Question with 4 options and instant feedback",    cat: "assessment"  },
  { id: "s_poll",       n: "Opinion Poll",         d: "Vote and see animated bar chart results",         cat: "assessment"  },
  { id: "s_hotspot",    n: "Image Hotspots",       d: "Click pulsing markers on an image to reveal info", cat: "interactive" },
  { id: "s_scenario",   n: "Branching Scenario",   d: "Decision tree: choose a path and see the outcome", cat: "interactive" },
  { id: "s_categorize", n: "Drag to Categorize",   d: "Drag items into correct category buckets",        cat: "assessment"  },
  { id: "s_promptflow", n: "Prompt Flow",          d: "Step through copyable AI prompts with progress",  cat: "interactive" }
];

// Shape hints for Claude. Keys that exist on the component's DEFAULTS entry.
// Used by list_components so Claude knows which fields to populate.
export const SCHEMAS = {
  highlight: ["title", "body"],
  callout:   ["type (tip|info|warning|success)", "body", "icon?"],
  quote:     ["body", "author"],
  divider:   ["title"],
  keypoints: ["title", "items[{title}]"],
  faq:       ["items[{title, desc}]"],
  numbered:  ["items[{icon?, title, desc}]"],
  checklist: ["items[{title}]"],
  glossary:  ["items[{title, desc}]"],
  cards:     ["items[{icon?, title, desc}]"],
  columns:   ["items[{title, desc}]"],
  process:   ["items[{title, desc}]"],
  iconrow:   ["items[{icon, title, desc}]"],
  timeline:  ["items[{icon?, title, desc}]"],
  progress:  ["active", "items[{title}]"],
  badge:     ["items[{title, color (green|blue|orange|gray)}]"],
  table:     ["col1", "col2", "items[{title, desc}]"],
  compare:   ["col1", "col2", "items[{title, desc, desc2}]"],
  stats:     ["items[{title, desc}]"],
  twostat:   ["stat", "label", "body"],
  kpi:       ["items[{title, desc, desc2}]"],
  donut:     ["stat", "label", "items[{title, desc (number)}]"],
  bar:       ["items[{title, desc (number 0-100)}]"],
  matrix:    ["xLabel", "yLabel", "items[{title, desc}] × 4"],
  swot:      ["items[{title, desc}] × 4 (S,W,O,T order)"],
  pyramid:   ["items[{title, desc}]"],
  funnel:    ["items[{title, desc}]"],
  proscons:  ["col1", "col2", "items[{title, body, desc (+|-)}]"],
  dodont:    ["col1", "col2", "items[{title, body, desc (+|-)}]"],
  roadmap:   ["items[{title, desc}]"],
  aiprompt:  ["title", "body"],
  s_flipcard:   ["title", "body", "items[{icon?, title, desc, img?}]"],
  s_accordion:  ["title", "body", "items[{title, desc}]"],
  s_tabs:       ["title", "body", "items[{title, desc}]"],
  s_reveal:     ["title", "body", "items[{title, desc}]"],
  s_stepper:    ["title", "body", "items[{icon?, title, desc}]"],
  s_stacked:    ["title", "body", "items[{title, desc, img?}]"],
  s_cycle:      ["title", "body", "items[{icon, title, desc}] × 4"],
  s_timeline_i: ["title", "body", "items[{title, desc}]"],
  s_sort:       ["title", "body", "items[{title}] (in correct order)"],
  s_match:      ["title", "body", "items[{title, desc}]"],
  s_quiz:       ["title", "body", "items: [{title: question}, {title: option, desc: '1' if correct else '0'} × 4]"],
  s_poll:       ["title", "body", "items[{title, desc (%)}]"],
  s_hotspot:    ["title", "body", "img (URL)", "items[{title, desc, x (0-100), y (0-100)}]"],
  s_scenario:   ["title", "body", "items[{title, desc, outcome (good|bad|neutral)}]"],
  s_categorize: ["title", "body", "col1", "col2", "items[{title, desc ('1' or '2')}]"],
  s_promptflow: ["title", "body", "items[{title, prompt, desc?}]"]
};

// Example data for each component. Small, illustrative — shown to Claude so it
// can pattern-match the correct shape when filling new content.
export const EXAMPLES = {
  highlight: { title: "Unleash. Unlock. Upskill.", body: "BCG U delivers transformative upskilling outcomes at speed, at scale, and with measurable return on learning investment." },
  callout:   { type: "tip", body: "AI transformation requires both top-down strategic vision and bottom-up experimentation." },
  quote:     { body: "The organizations that will thrive treat AI not as a technology initiative, but as a fundamental transformation.", author: "BCG Global AI Study, 2025" },
  divider:   { title: "Next section" },
  cards:     { items: [
    { icon: "DataAnalysis", title: "Define success", desc: "Set metrics for AI transformation" },
    { icon: "Coach", title: "Build talent", desc: "Upskill for AI proficiency" },
    { icon: "GroupCollaboration", title: "Move culture", desc: "Set AI use expectations" }
  ] },
  numbered:  { items: [
    { icon: "DataAnalysis", title: "Assess maturity", desc: "Evaluate readiness" },
    { icon: "LogicTree", title: "Define ambition", desc: "Set 12-18 month goals" },
    { icon: "LightBulb", title: "Identify use cases", desc: "Pick 3-5 to pilot" },
    { icon: "Toolbox", title: "Build capabilities", desc: "Data, talent, governance" },
    { icon: "DigitalGrowth", title: "Scale", desc: "Expand with playbooks" }
  ] },
  s_flipcard: { title: "Interactive", body: "Tap each card to explore", items: [
    { icon: "LogicTree", title: "AI Strategy", desc: "Align AI initiatives with business objectives to maximize value." },
    { icon: "DataAnalysis", title: "Data Foundation", desc: "Build robust data infrastructure for reliable AI training." },
    { icon: "Coach", title: "Talent", desc: "Develop internal capabilities through upskilling." }
  ] },
  s_quiz: { title: "Knowledge Check", body: "RAG grounds model responses in real, current facts.", items: [
    { title: "What is the primary benefit of RAG?" },
    { title: "Faster training", desc: "0" },
    { title: "Access to current, verified information", desc: "1" },
    { title: "Lower compute", desc: "0" },
    { title: "Better grammar", desc: "0" }
  ] },
  s_promptflow: { title: "AI Prompt Workflow", body: "Copy each prompt — work through them in order.", items: [
    { title: "Generate an outline", prompt: "Create a detailed outline for a 10-page strategy document on [YOUR TOPIC]. Include executive summary, problem statement, approach, metrics, risks, and next steps.", desc: "Use this first to get a clean document structure." },
    { title: "Draft the executive summary", prompt: "Write a 3-paragraph executive summary for a strategy document on [YOUR TOPIC] for a C-suite audience. Focus on business impact, not technical detail.", desc: "Run after you've reviewed the outline above." }
  ] }
};

// Brand keys supported by the toolkit (matches window.B in index.html).
export const BRANDS = ["bcg", "bcgu", "custom"];
