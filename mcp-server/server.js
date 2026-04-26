#!/usr/bin/env node
// BCG U Studio — MCP server + local bridge.
//
// Runs three things at once:
//   1) MCP stdio server  — Claude Desktop connects via the config in README.md.
//   2) HTTP server       — serves index.html from the parent folder at http://localhost:7724/
//   3) WebSocket server  — /ws endpoint. The toolkit page connects on load and
//                          listens for { type: "open", comp, data, brand } pushes.
//
// MCP tools exposed to Claude:
//   list_components()                            → catalog + schema hints + examples
//   open_in_toolkit(comp, data, brand?)          → pushes data into the running toolkit
//                                                  tab (opens the tab first if not open)
//
// Design decision: the toolkit itself stays a static single file. The MCP server
// never writes to index.html at runtime — it only hands the page a live data feed.
// That means the toolkit still works standalone (WebSocket connect silently fails
// when the server isn't running).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import AdmZip from "adm-zip";
import mammoth from "mammoth";
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, PageBreak, ShadingType, LevelFormat,
} from "docx";
import { HTML_COMPS, SCORM_COMPS, SCHEMAS, EXAMPLES, BRANDS } from "./catalog.js";

// pdf-parse triggers a debug-mode read on its package entry; import the inner file directly.
let pdfParse = null;
async function getPdfParse() {
  if (pdfParse) return pdfParse;
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  pdfParse = mod.default || mod;
  return pdfParse;
}

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path-adaptive: works in dev layout (mcp-server/ is a subfolder of the toolkit),
// DXT-packed flat layout (server.js + index.html in the same dir), and a nested
// DXT layout (server/ alongside toolkit/). First hit wins.
const TOOLKIT_CANDIDATES = [
  path.resolve(__dirname, ".."),            // dev: full-package/mcp-server/server.js → full-package/index.html
  path.resolve(__dirname),                  // DXT flat: <ext>/server.js + <ext>/index.html
  path.resolve(__dirname, "../toolkit"),    // DXT nested: <ext>/server/server.js + <ext>/toolkit/index.html
  path.resolve(__dirname, "../../toolkit"), // belt-and-suspenders for alt layouts
];
const TOOLKIT_DIR = path.resolve(
  (process.env.BCG_TOOLKIT_DIR && fs.existsSync(path.join(process.env.BCG_TOOLKIT_DIR, "index.html")))
    ? process.env.BCG_TOOLKIT_DIR
    : (TOOLKIT_CANDIDATES.find((d) => fs.existsSync(path.join(d, "index.html"))) || TOOLKIT_CANDIDATES[0])
);
const TOOLKIT_HTML = path.join(TOOLKIT_DIR, "index.html");
const BCG_ICONS_JS = path.join(TOOLKIT_DIR, "bcg-icons.js");
const HTTP_PORT = Number(process.env.BCG_TOOLKIT_PORT || 7724);

// ---------------------------------------------------------------------------
// HTTP: serve index.html + any sibling assets the toolkit references.
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
};

function safeResolve(reqPath) {
  // Strip query, normalize, refuse anything that escapes TOOLKIT_DIR.
  // Use path.relative (not startsWith) so Windows forward/back-slash mismatch
  // between TOOLKIT_DIR (from env var) and abs (from path.resolve) doesn't
  // 403 every legitimate request.
  const clean = decodeURIComponent(reqPath.split("?")[0]).replace(/^\/+/, "");
  const target = clean === "" ? "index.html" : clean;
  const abs = path.resolve(TOOLKIT_DIR, target);
  const rel = path.relative(TOOLKIT_DIR, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return abs;
}

const httpServer = http.createServer((req, res) => {
  const abs = safeResolve(req.url || "/");
  if (!abs) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found: " + req.url); return; }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// WebSocket: one broadcast channel. Every connected toolkit tab receives every
// open_in_toolkit push. In normal use there's one tab; multi-tab is fine too.
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
// Mirror httpServer's EADDRINUSE swallow: WebSocketServer attaches to httpServer
// and re-emits its 'error' event. Without this handler, a stale port-busy from
// a co-running bcg-toolkit instance would crash the whole process.
wss.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    process.stderr.write(`[bcg-toolkit-mcp] (wss) port busy — staying in stdio-only mode.\n`);
    return;
  }
  process.stderr.write(`[bcg-toolkit-mcp] wss error: ${err && err.message}\n`);
});
const clients = new Set();
let queuedPush = null; // most recent push, replayed to the next client that connects
function queueForNextClient(msg) { queuedPush = msg; }

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
  try { ws.send(JSON.stringify({ type: "hello", from: "bcg-toolkit-mcp" })); } catch {}
  if (queuedPush) {
    try { ws.send(JSON.stringify(queuedPush)); } catch {}
    queuedPush = null;
  }
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  let delivered = 0;
  for (const ws of clients) {
    if (ws.readyState === 1) {
      try { ws.send(payload); delivered++; } catch {}
    }
  }
  return delivered;
}

// ---------------------------------------------------------------------------
// Open browser helper (cross-platform).
// ---------------------------------------------------------------------------
function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` :
    process.platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, () => { /* best effort */ });
}

// ---------------------------------------------------------------------------
// MCP server wiring.
// ---------------------------------------------------------------------------
const mcp = new Server(
  { name: "bcg-toolkit", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOL_DEFS = [
  {
    name: "list_components",
    description:
      "List every component available in BCG U Studio (HTML embeds and interactive SCORM activities). Returns id, name, category, data schema hint, and an example payload. HTML components paste into any LMS's HTML block (Rise, NovoEd, Docebo, Moodle, Canvas); SCORM zips upload to any SCORM-compatible LMS. Use this first when you need to know which component fits a learning objective.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "html", "scorm"],
          description: "Limit to HTML-only or SCORM-only components. Default: all.",
        },
      },
    },
  },
  {
    name: "open_in_toolkit",
    description:
      "Open a component in the local BCG U Studio browser tab, pre-filled with your data. If the tab is not already open, this tool opens http://localhost:" +
      HTTP_PORT +
      "/ in the user's default browser. The LD can then edit, re-brand, and export to HTML (for any LMS's HTML block) or SCORM (for any SCORM-compatible LMS). Call list_components first if you need to know which fields `data` must contain.",
    inputSchema: {
      type: "object",
      required: ["comp", "data"],
      properties: {
        comp: {
          type: "string",
          description: "Component id from list_components (e.g. 'cards', 's_flipcard', 's_promptflow').",
        },
        data: {
          type: "object",
          description: "Component payload shaped per the schema returned by list_components.",
        },
        brand: {
          type: "string",
          enum: BRANDS,
          description: "Brand theme. Default 'bcg'.",
        },
      },
    },
  },
  {
    name: "toolkit_status",
    description:
      "Check whether BCG U Studio is running locally and how many browser tabs are currently connected. Useful if open_in_toolkit appears to not have reached a browser.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "suggest_component",
    description:
      "Suggest the best BCG U Studio components for a given learning-design topic or goal. Returns the top matches (with id, name, rationale, and starter data) from the 31 HTML + 16 SCORM catalog. Use this before open_in_toolkit when the LD asks for something like 'show me 3 key stats' or 'I want learners to practice ordering steps'.",
    inputSchema: {
      type: "object",
      required: ["topic"],
      properties: {
        topic: {
          type: "string",
          description: "Short description of the learning goal or content chunk (e.g. 'compare 3 consulting frameworks', 'drag-sort 6 steps of the BCG growth-share matrix').",
        },
        filter: {
          type: "string",
          enum: ["all", "html", "scorm"],
          description: "Limit recommendations to HTML-only or SCORM-only. Default: all.",
        },
        limit: {
          type: "number",
          description: "How many suggestions to return. Default 3, max 6.",
        },
      },
    },
  },
  {
    name: "push_journey",
    description:
      "Push a full learning-journey structure into BCG U Studio's Journey Builder canvas. Opens the tab to the journey view if it isn't already, and replaces or appends modules. Each module is { title, type, duration (min), components (array of component ids), notes }. Use after list_components so you know which component ids are valid.",
    inputSchema: {
      type: "object",
      required: ["journey"],
      properties: {
        journey: {
          type: "object",
          required: ["title", "modules"],
          properties: {
            title: { type: "string", description: "Journey title" },
            audience: { type: "string", description: "Who this is for" },
            modules: {
              type: "array",
              description: "Ordered list of modules",
              items: {
                type: "object",
                required: ["title", "type"],
                properties: {
                  title: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["intro", "core", "scorm", "assess", "reflect"],
                    description: "Module type — drives the color chip in the canvas.",
                  },
                  duration: { type: "number", description: "Duration in minutes." },
                  components: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of component ids (see list_components).",
                  },
                  notes: { type: "string", description: "Script / talking points / design notes." },
                },
              },
            },
          },
        },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description: "replace the current canvas or append to it. Default: replace.",
        },
      },
    },
  },
  {
    name: "video_info",
    description:
      "Inspect a local video file with ffprobe. Returns duration, resolution, fps, codec, and file size. Requires ffmpeg/ffprobe on PATH (https://ffmpeg.org). Use this before trim_video / extract_thumbnail so durations and timecodes line up.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Absolute path to the video file on disk." },
      },
    },
  },
  {
    name: "trim_video",
    description:
      "Trim a video between two timecodes using ffmpeg (copy-codec, fast). Good for lifting a 30-sec clip out of a long recording to embed in a SCORM interactive or lesson. Requires ffmpeg on PATH.",
    inputSchema: {
      type: "object",
      required: ["input", "start", "end"],
      properties: {
        input: { type: "string", description: "Absolute path to source video." },
        start: { type: "string", description: "Start timecode (HH:MM:SS.mmm or seconds, e.g. '00:01:23.5' or '83.5')." },
        end: { type: "string", description: "End timecode in the same format." },
        output: { type: "string", description: "Absolute output path. Defaults to <input>-trim.<ext> in the same folder." },
        reencode: { type: "boolean", description: "Re-encode instead of copy codec (slower, more accurate cuts). Default false." },
      },
    },
  },
  {
    name: "extract_thumbnail",
    description:
      "Extract a single-frame thumbnail from a video using ffmpeg. Great for making a Rise / NovoEd module hero card. Default: grabs the frame at 2 seconds as a high-quality JPG. Requires ffmpeg on PATH.",
    inputSchema: {
      type: "object",
      required: ["input"],
      properties: {
        input: { type: "string", description: "Absolute path to source video." },
        time: { type: "string", description: "Timecode (HH:MM:SS or seconds). Default '00:00:02'." },
        output: { type: "string", description: "Absolute output path. Defaults to <input>-thumb.jpg. Extension decides format (.jpg/.png/.webp)." },
        width: { type: "number", description: "Output width in pixels. Preserves aspect ratio. Default 1280." },
      },
    },
  },
  {
    name: "check_ffmpeg",
    description:
      "Check whether ffmpeg and ffprobe are installed and available on PATH. Call this once at the start of a media session to fail early with a helpful install pointer.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ingest_source",
    description:
      "Read a source file (PPTX, PDF, DOCX, MD, or TXT) and return structured chunks the LD can hand to draft_storyline. Each chunk carries title + body text + (where available) speaker notes. Use this when an LD says 'turn this deck into a course' or 'use my whitepaper as the source'. Files stay on the user's machine — nothing is uploaded.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Absolute path to the source file (.pptx, .pdf, .docx, .md, .txt)." },
        max_chunks: { type: "number", description: "Cap on returned chunks. Default 60." },
      },
    },
  },
  {
    name: "draft_storyline",
    description:
      "Turn a brief (and optional ingested source) into a structured course storyline ready to be written to a Word file. Returns JSON with cover, overview, modules[lessons[body, component_suggestion, video_script, knowledge_check]], and appendix. This is the planning step — no file is written here. After review, hand the JSON to assemble_storyline_docx. Use this BEFORE assemble_storyline_docx every time.",
    inputSchema: {
      type: "object",
      required: ["topic", "audience", "duration_min"],
      properties: {
        topic: { type: "string", description: "Course topic (e.g. 'AI ethics for new analysts')." },
        audience: { type: "string", description: "Who the course is for (e.g. 'BCG new-joiner consultants, week 1')." },
        duration_min: { type: "number", description: "Total target duration in minutes (e.g. 25, 45, 90)." },
        owner: { type: "string", description: "LD or owner name to put on the cover. Defaults to 'BCG U Studio'." },
        learning_outcomes: {
          type: "array",
          items: { type: "string" },
          description: "Optional: 3–5 explicit learning outcomes. If omitted, drafts will be generated.",
        },
        modules: {
          type: "array",
          description: "Optional: pre-defined module skeleton — { title, lessons:[{title, body?}], duration? }. If omitted, a structure is drafted.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              duration: { type: "number" },
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                  },
                },
              },
            },
          },
        },
        source: {
          type: "object",
          description: "Optional: chunks returned by ingest_source. Used as factual seed when drafting body text.",
        },
        options: {
          type: "object",
          description: "Optional flags: { include_video_scripts: bool (default true), questions_per_lesson: number (default 2), include_glossary: bool (default true) }.",
        },
      },
    },
  },
  {
    name: "assemble_storyline_docx",
    description:
      "Write a course storyline JSON to a .docx file at the given output path. Cover page, overview with learning outcomes + structure table, per-module sections (heading + objective + per-lesson body + component callout + video-script table + knowledge-check Q&A), and appendix (glossary + design notes). Pass the object returned by draft_storyline as `course`. Output path must be absolute and end with .docx.",
    inputSchema: {
      type: "object",
      required: ["course", "output_path"],
      properties: {
        course: {
          type: "object",
          description: "Course JSON in the shape returned by draft_storyline (meta, overview, modules[], appendix).",
        },
        output_path: {
          type: "string",
          description: "Absolute path for the output .docx file (e.g. C:\\\\Users\\\\me\\\\Desktop\\\\ai-ethics-course.docx).",
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Media tools: ffmpeg / ffprobe helpers. Absolute paths only.
// ---------------------------------------------------------------------------
const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mpg", ".mpeg"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function which(cmd) {
  // Try a platform-safe lookup without throwing on 1-status.
  const probe = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
  try {
    const { stdout } = await execAsync(probe, { timeout: 3000 });
    return stdout.trim().split(/\r?\n/)[0] || "";
  } catch {
    return "";
  }
}

function validateAbsPath(p, { mustExist = false, purpose = "path" } = {}) {
  if (!p || typeof p !== "string") return { err: `${purpose} is required.` };
  if (!path.isAbsolute(p)) return { err: `${purpose} must be an absolute path (got '${p}').` };
  const norm = path.normalize(p);
  if (mustExist && !fs.existsSync(norm)) return { err: `${purpose} does not exist: ${norm}` };
  return { ok: norm };
}

function formatDuration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = (s % 60).toFixed(2);
  return (hh ? String(hh).padStart(2, "0") + ":" : "") + String(mm).padStart(2, "0") + ":" + String(ss).padStart(5, "0");
}

// ---------------------------------------------------------------------------
// Topic → component scoring for suggest_component.
// ---------------------------------------------------------------------------
const TOPIC_HINTS = {
  // Component id → keyword bag that hints at topical fit.
  highlight:   ["banner", "hero", "callout", "key message", "announcement"],
  callout:     ["note", "tip", "warning", "aside", "callout", "info box"],
  quote:       ["quote", "testimonial", "pullquote", "voice", "expert"],
  table:       ["table", "matrix", "comparison table", "rows and columns"],
  compare:     ["compare", "versus", "vs", "before after", "old new", "side by side"],
  cards:       ["cards", "tiles", "grid", "summary", "overview", "features"],
  timeline:    ["timeline", "history", "milestones", "steps in time", "phases"],
  stats:       ["stat", "statistic", "kpi", "metric", "number"],
  "stat-row":  ["stat row", "metrics", "kpis", "headline numbers"],
  swot:        ["swot", "strengths weaknesses opportunities threats"],
  "2x2":       ["2x2", "two by two", "quadrant", "matrix", "prioritization"],
  pyramid:     ["pyramid", "hierarchy", "levels", "maslow", "minto"],
  funnel:      ["funnel", "conversion", "stages", "narrowing"],
  roadmap:     ["roadmap", "phases", "timeline strategy", "horizon"],
  kpi:         ["kpi", "dashboard", "metric tile"],
  "bar-chart": ["bar chart", "ranking", "compare values"],
  donut:       ["donut", "pie", "share", "percentage breakdown"],
  s_flip:      ["flip card", "reveal", "memorize", "term definition"],
  s_accordion: ["accordion", "faq", "collapse", "expand"],
  s_tabs:      ["tabs", "segmented view", "categories"],
  s_cycle:     ["cycle", "loop", "continuous improvement", "process"],
  s_promptflow:["prompt flow", "guided scenario", "dialog"],
  s_branching: ["branching", "scenario", "choose your path", "decision tree"],
  s_hotspot:   ["hotspot", "click to reveal", "anatomy", "diagram annotation"],
  s_drag_sort: ["drag sort", "order", "sequence", "arrange", "rank"],
  s_quiz:      ["quiz", "mcq", "knowledge check", "assessment"],
  s_poll:      ["poll", "survey", "sentiment"],
  s_stacked:   ["stacked cards", "layered", "reveal sequence"],
};

function scoreForTopic(c, topicLower) {
  const hayParts = [c.n, c.d, c.cat, (TOPIC_HINTS[c.id] || []).join(" ")];
  const hay = hayParts.join(" ").toLowerCase();
  if (!topicLower) return 0;
  // split topic into words, score each word's presence
  const words = topicLower.split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  let score = 0;
  for (const w of words) {
    if (c.id.toLowerCase().includes(w)) score += 8;
    if (c.n.toLowerCase().includes(w)) score += 6;
    if (hay.includes(w)) score += 2;
  }
  // exact phrase hits in hint list
  for (const hint of TOPIC_HINTS[c.id] || []) {
    if (topicLower.includes(hint)) score += 10;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Storyline Generator (Day 7).
// Reads PPTX/PDF/DOCX/MD/TXT into structured chunks; drafts a course JSON;
// writes the JSON to a clean default Word file. All processing is local.
// ---------------------------------------------------------------------------
const STORY_EXTS = new Set([".pptx", ".pdf", ".docx", ".md", ".markdown", ".txt"]);

function stripXmlText(xml) {
  // Pull text out of <a:t>...</a:t> nodes (PowerPoint), preserving paragraph breaks.
  const out = [];
  const paraRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pm;
  while ((pm = paraRe.exec(xml))) {
    const inner = pm[1];
    const txtRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const buf = [];
    let tm;
    while ((tm = txtRe.exec(inner))) {
      buf.push(tm[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"));
    }
    if (buf.length) out.push(buf.join(""));
  }
  return out.join("\n").trim();
}

async function ingestPptx(absPath) {
  const zip = new AdmZip(absPath);
  const entries = zip.getEntries();
  const slideRe = /^ppt\/slides\/slide(\d+)\.xml$/;
  const notesRe = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;
  const slides = new Map();
  const notes = new Map();
  for (const e of entries) {
    const m1 = slideRe.exec(e.entryName);
    if (m1) slides.set(Number(m1[1]), e.getData().toString("utf8"));
    const m2 = notesRe.exec(e.entryName);
    if (m2) notes.set(Number(m2[1]), e.getData().toString("utf8"));
  }
  const ordered = [...slides.keys()].sort((a, b) => a - b);
  const chunks = [];
  for (const n of ordered) {
    const text = stripXmlText(slides.get(n) || "");
    const notesText = notes.has(n) ? stripXmlText(notes.get(n)) : null;
    const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const title = lines[0] || `Slide ${n}`;
    const body = lines.slice(1).join("\n");
    chunks.push({
      index: n,
      title,
      body,
      notes: notesText && notesText.length > 0 ? notesText : null,
    });
  }
  return chunks;
}

async function ingestPdfFile(absPath) {
  const pp = await getPdfParse();
  const buf = fs.readFileSync(absPath);
  const data = await pp(buf);
  const text = String(data.text || "");
  // pdf-parse delimits pages with form-feed (\f). Use it when present, else split by 2+ blank lines.
  const pages = text.includes("\f")
    ? text.split("\f")
    : text.split(/\n\s*\n\s*\n+/);
  return pages
    .map((p, i) => p.trim())
    .filter((p) => p.length > 0)
    .map((p, i) => {
      const lines = p.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      const title = lines[0] && lines[0].length <= 120 ? lines[0] : `Page ${i + 1}`;
      const body = lines[0] === title ? lines.slice(1).join("\n") : lines.join("\n");
      return { index: i + 1, title, body, notes: null };
    });
}

async function ingestDocxFile(absPath) {
  const buf = fs.readFileSync(absPath);
  // extractRawText loses headings; use convertToHtml then strip — gives us heading hints.
  const html = await mammoth.convertToHtml({ buffer: buf });
  const raw = String(html.value || "");
  // Split on h1/h2 boundaries.
  const sections = raw.split(/(?=<h[12][^>]*>)/i).filter((s) => s.trim());
  if (sections.length <= 1) {
    // No headings — fall back to raw text by paragraphs.
    const txt = await mammoth.extractRawText({ buffer: buf });
    const paras = String(txt.value || "").split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
    return paras.map((p, i) => {
      const lines = p.split(/\n+/);
      return { index: i + 1, title: lines[0].slice(0, 120) || `Section ${i + 1}`, body: lines.slice(1).join("\n"), notes: null };
    });
  }
  const stripTags = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return sections.map((s, i) => {
    const head = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/i.exec(s);
    const title = head ? stripTags(head[1]) : `Section ${i + 1}`;
    const rest = head ? s.slice(head.index + head[0].length) : s;
    const body = stripTags(rest);
    return { index: i + 1, title: title || `Section ${i + 1}`, body, notes: null };
  });
}

function ingestPlainText(absPath) {
  const txt = fs.readFileSync(absPath, "utf8");
  // Split on Markdown headings (#, ##) or 2+ blank lines.
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  const indices = [];
  let m;
  while ((m = headingRe.exec(txt))) indices.push({ at: m.index, level: m[1].length, title: m[2].trim() });
  if (indices.length === 0) {
    // No headings — split by blank lines.
    const blocks = txt.split(/\n\s*\n\s*\n*/).map((s) => s.trim()).filter(Boolean);
    return blocks.map((b, i) => {
      const lines = b.split(/\n+/);
      return { index: i + 1, title: lines[0].slice(0, 120) || `Section ${i + 1}`, body: lines.slice(1).join("\n"), notes: null };
    });
  }
  const chunks = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].at;
    const end = i + 1 < indices.length ? indices[i + 1].at : txt.length;
    const block = txt.slice(start, end);
    const body = block.replace(/^#{1,6}\s+.+\n?/, "").trim();
    chunks.push({ index: i + 1, title: indices[i].title, body, notes: null });
  }
  return chunks;
}

async function ingestSourceFile(absPath, maxChunks) {
  const ext = path.extname(absPath).toLowerCase();
  if (!STORY_EXTS.has(ext)) {
    throw new Error(`Unsupported source extension: ${ext}. Supported: ${[...STORY_EXTS].join(", ")}`);
  }
  let chunks;
  let type;
  if (ext === ".pptx") { type = "pptx"; chunks = await ingestPptx(absPath); }
  else if (ext === ".pdf") { type = "pdf"; chunks = await ingestPdfFile(absPath); }
  else if (ext === ".docx") { type = "docx"; chunks = await ingestDocxFile(absPath); }
  else { type = ext === ".md" || ext === ".markdown" ? "md" : "txt"; chunks = ingestPlainText(absPath); }
  const cap = Math.max(1, Math.min(500, maxChunks || 60));
  const truncated = chunks.length > cap;
  return {
    source_path: absPath,
    source_type: type,
    chunks: chunks.slice(0, cap),
    total_chunks: chunks.length,
    truncated,
  };
}

// Pick a default component id for a lesson based on title/body keywords.
function pickComponentForLesson(title, body) {
  const text = `${title || ""}\n${body || ""}`.toLowerCase();
  const all = HTML_COMPS.concat(SCORM_COMPS);
  let best = null;
  let bestScore = 0;
  for (const c of all) {
    const s = scoreForTopic(c, text);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  if (!best || bestScore < 4) {
    // safe default
    return { id: "cards", name: "Cards", why: "Versatile multi-point summary; works for most explainer lessons." };
  }
  return {
    id: best.id,
    name: best.n,
    why: `Title/body keywords match this component's intent (score ${bestScore}).`,
  };
}

function defaultLearningOutcomes(topic, audience) {
  return [
    `Define the core concepts of ${topic}.`,
    `Apply ${topic} to a realistic ${audience || "workplace"} scenario.`,
    `Identify common pitfalls and decide when to escalate to a senior reviewer.`,
    `Communicate the trade-offs to a non-technical stakeholder.`,
  ];
}

function defaultModuleSkeleton(topic, durationMin) {
  // Decide module count based on duration.
  let modCount;
  if (durationMin <= 15) modCount = 2;
  else if (durationMin <= 30) modCount = 3;
  else if (durationMin <= 60) modCount = 4;
  else if (durationMin <= 120) modCount = 5;
  else modCount = 6;
  const moduleTitles = [
    `Why ${topic} matters`,
    `Core concepts and frameworks`,
    `Apply it: a worked example`,
    `Edge cases and pitfalls`,
    `Decide and act: a branching scenario`,
    `Wrap-up and reflection`,
  ].slice(0, modCount);
  const perModuleMin = Math.max(3, Math.floor(durationMin / modCount));
  return moduleTitles.map((title, i) => ({
    title,
    duration: i === modCount - 1 ? Math.max(3, durationMin - perModuleMin * (modCount - 1)) : perModuleMin,
    lessons: [
      { title: `${title} — overview`, body: "" },
      { title: `${title} — practice`, body: "" },
    ],
  }));
}

function draftStorylinePure(args) {
  const {
    topic = "",
    audience = "",
    duration_min,
    owner = "BCG U Studio",
    learning_outcomes,
    modules,
    source,
    options = {},
  } = args || {};
  const opts = {
    include_video_scripts: options.include_video_scripts !== false,
    questions_per_lesson: Math.max(0, Math.min(5, Number(options.questions_per_lesson ?? 2))),
    include_glossary: options.include_glossary !== false,
  };
  const dur = Math.max(3, Number(duration_min) || 25);
  const outcomes = (Array.isArray(learning_outcomes) && learning_outcomes.length > 0)
    ? learning_outcomes.slice(0, 6)
    : defaultLearningOutcomes(topic, audience);
  const skeleton = (Array.isArray(modules) && modules.length > 0)
    ? modules
    : defaultModuleSkeleton(topic || "this topic", dur);

  // If source chunks exist, distribute their bodies across lessons round-robin
  // as factual seeds — Claude can override on a re-call with curated text.
  const sourceChunks = (source && Array.isArray(source.chunks)) ? source.chunks : [];
  let sIdx = 0;
  const nextSourceBody = () => {
    if (sourceChunks.length === 0) return "";
    const c = sourceChunks[sIdx % sourceChunks.length];
    sIdx++;
    return (c && c.body) ? String(c.body).slice(0, 600) : "";
  };

  const moduleObjs = skeleton.map((m, mi) => {
    const lessons = (Array.isArray(m.lessons) && m.lessons.length > 0)
      ? m.lessons
      : [{ title: `${m.title} — overview` }, { title: `${m.title} — practice` }];
    const lessonObjs = lessons.map((l, li) => {
      const title = String(l.title || `Lesson ${mi + 1}.${li + 1}`);
      let body = String(l.body || "").trim();
      if (!body) body = nextSourceBody();
      if (!body) body = `Introduce the key idea behind "${title}". Use a concrete example from the audience's day-to-day. Close with a 1-sentence "why this matters" line.`;
      const compPick = pickComponentForLesson(title, body);
      const learnObj = `By the end of this lesson, learners will be able to articulate ${title.toLowerCase()} in their own words.`;
      const lessonOut = {
        title,
        duration: Math.max(2, Math.round((m.duration || 5) / lessons.length)),
        learning_objective: learnObj,
        body,
        component_suggestion: compPick,
      };
      if (opts.include_video_scripts) {
        lessonOut.video_script = [
          { time: "0:00", visual: "Title card with lesson name", narration: `Welcome. In this short lesson we'll look at ${title}.` },
          { time: "0:10", visual: "Cut to instructor or kinetic text overlay", narration: "Here's the one thing to remember…" },
          { time: "0:35", visual: "Diagram or single key visual", narration: "Let me walk you through a quick example." },
          { time: "1:10", visual: "Close-out card with takeaway", narration: "Your turn — try the practice activity next." },
        ];
      }
      if (opts.questions_per_lesson > 0) {
        lessonOut.knowledge_check = Array.from({ length: opts.questions_per_lesson }, (_, qi) => ({
          q: `Q${qi + 1}: Which statement best describes ${title}?`,
          options: [
            "A. (correct) — captures the lesson's central idea in plain language",
            "B. A common but partial misconception",
            "C. A related-but-different concept",
            "D. An outdated or off-topic option",
          ],
          answer: "A",
          rationale: `Option A maps to the learning objective above. Use the body text of the lesson as the rationale source.`,
        }));
      }
      return lessonOut;
    });
    return {
      title: String(m.title || `Module ${mi + 1}`),
      duration: Math.max(3, Number(m.duration) || Math.round(dur / skeleton.length)),
      type: m.type || (mi === 0 ? "intro" : (mi === skeleton.length - 1 ? "reflect" : "core")),
      lessons: lessonObjs,
    };
  });

  // Glossary: pull a few capitalized phrases from source bodies + topic.
  let glossary = [];
  if (opts.include_glossary) {
    const seen = new Set();
    const candidates = [];
    const text = sourceChunks.map((c) => `${c.title}\n${c.body || ""}`).join("\n");
    const re = /\b([A-Z][A-Za-z0-9]{2,}(?:\s+[A-Z][A-Za-z0-9]+){0,3})\b/g;
    let mm;
    while ((mm = re.exec(text))) {
      const term = mm[1].trim();
      if (term.length < 3) continue;
      if (seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      candidates.push(term);
      if (candidates.length >= 8) break;
    }
    glossary = candidates.map((term) => ({
      term,
      definition: `Define '${term}' in plain language for ${audience || "the audience"}. (Auto-suggested from source — please review.)`,
    }));
  }

  return {
    meta: {
      title: topic ? `${topic}` : "Untitled Course",
      audience: audience || "Learning Designers",
      duration_min: dur,
      owner,
      version: "v0.1 — Draft",
      generated_at: new Date().toISOString(),
      source_path: source && source.source_path ? source.source_path : null,
    },
    overview: {
      learning_outcomes: outcomes,
      prerequisites: [
        "None — this is designed as a self-contained module.",
        "Familiarity with day-to-day work in the audience role helps but is not required.",
      ],
      structure: moduleObjs.map((m, i) => ({
        n: i + 1,
        title: m.title,
        duration: m.duration,
        type: m.type,
        lesson_count: m.lessons.length,
      })),
    },
    modules: moduleObjs,
    appendix: {
      glossary,
      design_notes: [
        "Component callouts ('[BCG U Studio: <id>]') tell the LMS-side builder which BCG U Studio component to drop in.",
        "Video scripts are 60-90s short-form by default — adjust narration length to your delivery speed.",
        "Knowledge-check questions are auto-suggested. Replace stem A with your own gold answer before publishing.",
        "BCG brand assumed — switch theme inside the toolkit before exporting if a different palette is needed.",
      ],
      references: source && source.source_path
        ? [`Source ingested: ${source.source_path} (${source.source_type || "unknown"}, ${source.total_chunks || 0} chunks)`]
        : ["No source file used. Body text is auto-drafted; replace before publishing."],
    },
  };
}

// ----- DOCX assembly --------------------------------------------------------
const DOC_BLUE = "0E4D8E";    // BCG U primary
const DOC_GREEN = "00A464";   // accent
const DOC_GRAY_BG = "F2F2F2";
const DOC_GRAY_TXT = "555555";

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    alignment: opts.align,
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text: String(text || ""), bold: !!opts.bold, italics: !!opts.italics, size: opts.size, color: opts.color, font: opts.font || "Calibri" })],
  });
}
function h(text, level, color) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: String(text || ""), bold: true, color: color || DOC_BLUE, font: "Calibri" })],
  });
}
function bulletList(items) {
  return items.map((t) => new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text: String(t), font: "Calibri" })],
  }));
}
function numberedList(items) {
  return items.map((t, i) => new Paragraph({
    numbering: { reference: "kc-numbering", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text: String(t), font: "Calibri" })],
  }));
}
function cellTxt(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { type: ShadingType.SOLID, color: opts.shade, fill: opts.shade } : undefined,
    children: [new Paragraph({
      alignment: opts.align,
      spacing: { after: 0 },
      children: [new TextRun({ text: String(text || ""), bold: !!opts.bold, color: opts.color, size: opts.size || 20, font: "Calibri" })],
    })],
  });
}
function fullWidthTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
    },
  });
}
function calloutPara(text) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.SOLID, color: DOC_GRAY_BG, fill: DOC_GRAY_BG },
    children: [new TextRun({ text: String(text), italics: true, color: DOC_GRAY_TXT, font: "Calibri", size: 20 })],
  });
}

function buildCoverPage(meta) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  return [
    new Paragraph({ spacing: { before: 1800 }, children: [new TextRun({ text: "BCG U Studio · Course Storyline", color: DOC_GREEN, size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER }),
    new Paragraph({ spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.title, bold: true, size: 56, color: DOC_BLUE, font: "Calibri" })] }),
    new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `For: ${meta.audience}`, size: 28, color: "333333", font: "Calibri" })] }),
    new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Duration: ${meta.duration_min} minutes`, size: 24, color: "555555", font: "Calibri" })] }),
    new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: `Owner: ${meta.owner}    ·    `, size: 20, color: "777777", font: "Calibri" }),
      new TextRun({ text: `Version: ${meta.version}    ·    `, size: 20, color: "777777", font: "Calibri" }),
      new TextRun({ text: `Date: ${dateStr}`, size: 20, color: "777777", font: "Calibri" }),
    ] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildOverview(course) {
  const ov = course.overview || {};
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cellTxt("#", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 8 }),
      cellTxt("Module", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 52 }),
      cellTxt("Duration (min)", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 20 }),
      cellTxt("Type", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 20 }),
    ],
  });
  const bodyRows = (ov.structure || []).map((s) => new TableRow({
    children: [
      cellTxt(String(s.n), { width: 8 }),
      cellTxt(s.title, { width: 52 }),
      cellTxt(String(s.duration), { width: 20, align: AlignmentType.CENTER }),
      cellTxt(s.type, { width: 20 }),
    ],
  }));
  return [
    h("Course Overview", HeadingLevel.HEADING_1),
    h("Learning Outcomes", HeadingLevel.HEADING_2, DOC_GREEN),
    p("By the end of this course, learners will be able to:"),
    ...bulletList(ov.learning_outcomes || []),
    h("Prerequisites", HeadingLevel.HEADING_2, DOC_GREEN),
    ...bulletList(ov.prerequisites || []),
    h("Course Structure", HeadingLevel.HEADING_2, DOC_GREEN),
    fullWidthTable([headerRow, ...bodyRows]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildLessonBlock(lesson, mi, li) {
  const out = [];
  out.push(h(`Lesson ${mi + 1}.${li + 1} — ${lesson.title}    (${lesson.duration || 5} min)`, HeadingLevel.HEADING_2));
  if (lesson.learning_objective) {
    out.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: lesson.learning_objective, italics: true, color: "555555", font: "Calibri" })],
    }));
  }
  // body
  const bodyParas = String(lesson.body || "").split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  if (bodyParas.length === 0) bodyParas.push("[Body text — to be drafted]");
  for (const para of bodyParas) out.push(p(para));
  // component callout
  if (lesson.component_suggestion && lesson.component_suggestion.id) {
    const cs = lesson.component_suggestion;
    out.push(calloutPara(`[BCG U Studio: ${cs.id}] — ${cs.name}. ${cs.why || ""}`));
  }
  // video script table
  if (Array.isArray(lesson.video_script) && lesson.video_script.length > 0) {
    out.push(h("Video Script", HeadingLevel.HEADING_3, DOC_GREEN));
    const head = new TableRow({
      tableHeader: true,
      children: [
        cellTxt("Time", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 12 }),
        cellTxt("Visual", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 38 }),
        cellTxt("Narration", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 50 }),
      ],
    });
    const rows = lesson.video_script.map((v) => new TableRow({
      children: [
        cellTxt(v.time || "", { width: 12, align: AlignmentType.CENTER }),
        cellTxt(v.visual || "", { width: 38 }),
        cellTxt(v.narration || "", { width: 50 }),
      ],
    }));
    out.push(fullWidthTable([head, ...rows]));
  }
  // knowledge check
  if (Array.isArray(lesson.knowledge_check) && lesson.knowledge_check.length > 0) {
    out.push(h("Knowledge Check", HeadingLevel.HEADING_3, DOC_GREEN));
    lesson.knowledge_check.forEach((kc, qi) => {
      out.push(p([new TextRun({ text: `Q${qi + 1}. `, bold: true, font: "Calibri" }), new TextRun({ text: String(kc.q || ""), font: "Calibri" })]));
      (kc.options || []).forEach((opt) => out.push(p(`    ${opt}`)));
      out.push(p([
        new TextRun({ text: "Answer: ", bold: true, color: DOC_GREEN, font: "Calibri" }),
        new TextRun({ text: String(kc.answer || ""), font: "Calibri" }),
        new TextRun({ text: "    ·    ", color: "AAAAAA", font: "Calibri" }),
        new TextRun({ text: "Rationale: ", bold: true, color: "555555", font: "Calibri" }),
        new TextRun({ text: String(kc.rationale || ""), italics: true, color: "555555", font: "Calibri" }),
      ]));
    });
  }
  return out;
}

function buildModule(mod, mi) {
  const out = [];
  out.push(h(`Module ${mi + 1} — ${mod.title}    (${mod.duration || 5} min · ${mod.type || "core"})`, HeadingLevel.HEADING_1));
  out.push(calloutPara(`Learners will move through ${mod.lessons.length} lesson${mod.lessons.length === 1 ? "" : "s"} in this module.`));
  (mod.lessons || []).forEach((l, li) => {
    buildLessonBlock(l, mi, li).forEach((c) => out.push(c));
  });
  out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

function buildAppendix(course) {
  const ap = course.appendix || {};
  const out = [];
  out.push(h("Appendix", HeadingLevel.HEADING_1));
  if (Array.isArray(ap.glossary) && ap.glossary.length > 0) {
    out.push(h("Glossary", HeadingLevel.HEADING_2, DOC_GREEN));
    const head = new TableRow({
      tableHeader: true,
      children: [
        cellTxt("Term", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 30 }),
        cellTxt("Definition", { bold: true, color: "FFFFFF", shade: DOC_BLUE, width: 70 }),
      ],
    });
    const rows = ap.glossary.map((g) => new TableRow({
      children: [
        cellTxt(g.term || "", { width: 30, bold: true }),
        cellTxt(g.definition || "", { width: 70 }),
      ],
    }));
    out.push(fullWidthTable([head, ...rows]));
  }
  if (Array.isArray(ap.design_notes) && ap.design_notes.length > 0) {
    out.push(h("Design Notes for Builder", HeadingLevel.HEADING_2, DOC_GREEN));
    out.push(...bulletList(ap.design_notes));
  }
  if (Array.isArray(ap.references) && ap.references.length > 0) {
    out.push(h("References", HeadingLevel.HEADING_2, DOC_GREEN));
    out.push(...bulletList(ap.references));
  }
  return out;
}

async function buildStorylineDocx(course, outputPath) {
  const meta = course.meta || { title: "Untitled Course", audience: "Learners", duration_min: 25, owner: "BCG U Studio", version: "v0.1" };
  const sectionChildren = [
    ...buildCoverPage(meta),
    ...buildOverview(course),
    ...((course.modules || []).flatMap((m, i) => buildModule(m, i))),
    ...buildAppendix(course),
  ];
  const doc = new Document({
    creator: meta.owner || "BCG U Studio",
    title: meta.title,
    description: `Storyline draft generated by BCG U Studio for ${meta.audience}`,
    numbering: {
      config: [
        { reference: "kc-numbering", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }] },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ properties: {}, children: sectionChildren }],
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buf);
  return { ok: true, output_path: outputPath, size_kb: Number((buf.length / 1024).toFixed(1)) };
}

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  if (name === "list_components") {
    const filter = args.filter || "all";
    const html = filter === "scorm" ? [] : HTML_COMPS;
    const scorm = filter === "html" ? [] : SCORM_COMPS;
    const pack = (arr) =>
      arr.map((c) => ({
        id: c.id,
        name: c.n,
        category: c.cat,
        description: c.d,
        schema: SCHEMAS[c.id] || [],
        example: EXAMPLES[c.id] || null,
      }));
    const payload = {
      brands: BRANDS,
      html: pack(html),
      scorm: pack(scorm),
      notes: [
        "HTML components export as paste-ready <div>/<table> markup for Rise or any rich editor.",
        "SCORM components export as SCORM 1.2 zip packages that are self-editing (Ctrl+Shift+E opens the in-activity editor inside any LMS's SCORM player).",
        "Fields ending in '?' are optional. Fields like items[{...}] describe repeating item objects.",
        "For icon fields, use a BCG icon name (e.g. 'DataAnalysis', 'Coach') when you want a branded icon; any other string renders as a plain label.",
      ],
    };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }

  if (name === "open_in_toolkit") {
    const comp = String(args.comp || "");
    const data = args.data && typeof args.data === "object" ? args.data : {};
    const brand = BRANDS.includes(args.brand) ? args.brand : "bcg";
    const known = HTML_COMPS.concat(SCORM_COMPS).some((c) => c.id === comp);
    if (!known) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown component id: ${comp}. Call list_components to see valid ids.` }],
      };
    }
    const delivered = broadcast({ type: "open", comp, data, brand, ts: Date.now() });
    if (delivered === 0) {
      // No browser tab connected yet — open one. It will receive the same
      // payload via a queued-replay on connect (below).
      queueForNextClient({ type: "open", comp, data, brand, ts: Date.now() });
      openBrowser(`http://localhost:${HTTP_PORT}/#mcp`);
      return {
        content: [{
          type: "text",
          text: `Toolkit tab opened in browser (http://localhost:${HTTP_PORT}/). Component '${comp}' will load once the tab finishes connecting. If it doesn't appear in ~5 seconds, call toolkit_status.`,
        }],
      };
    }
    return {
      content: [{ type: "text", text: `Pushed '${comp}' (${brand}) to ${delivered} toolkit tab(s).` }],
    };
  }

  if (name === "toolkit_status") {
    return {
      content: [{ type: "text", text: JSON.stringify({
        http: `http://localhost:${HTTP_PORT}/`,
        toolkit_html_exists: fs.existsSync(TOOLKIT_HTML),
        bcg_icons_js_exists: fs.existsSync(BCG_ICONS_JS),
        connected_browser_tabs: clients.size,
        queued_push: queuedPush ? { comp: queuedPush.comp, brand: queuedPush.brand } : null,
      }, null, 2) }],
    };
  }

  if (name === "suggest_component") {
    const topic = String(args.topic || "").trim();
    const filter = args.filter || "all";
    const limit = Math.max(1, Math.min(6, Number(args.limit) || 3));
    if (!topic) {
      return { isError: true, content: [{ type: "text", text: "topic is required." }] };
    }
    const pool = []
      .concat(filter === "scorm" ? [] : HTML_COMPS.map((c) => ({ ...c, type: "html" })))
      .concat(filter === "html" ? [] : SCORM_COMPS.map((c) => ({ ...c, type: "scorm" })));
    const tl = topic.toLowerCase();
    const scored = pool
      .map((c) => ({ c, s: scoreForTopic(c, tl) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ c, s }) => ({
        id: c.id,
        name: c.n,
        type: c.type,
        category: c.cat,
        match_score: s,
        description: c.d,
        schema: SCHEMAS[c.id] || [],
        example: EXAMPLES[c.id] || null,
        rationale: `Matches '${topic}' via name/description/intent keywords (score ${s}).`,
      }));
    if (scored.length === 0) {
      // Fall back: return 3 most versatile components
      const fallback = ["cards", "callout", "stat-row"].map((id) => {
        const c = HTML_COMPS.find((x) => x.id === id);
        return c && {
          id: c.id, name: c.n, type: "html", category: c.cat,
          match_score: 0, description: c.d,
          schema: SCHEMAS[c.id] || [], example: EXAMPLES[c.id] || null,
          rationale: "No direct keyword match. This is a safe default for most topics.",
        };
      }).filter(Boolean);
      return { content: [{ type: "text", text: JSON.stringify({ topic, suggestions: fallback, note: "No keyword match — returning versatile defaults." }, null, 2) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify({ topic, suggestions: scored }, null, 2) }] };
  }

  if (name === "check_ffmpeg") {
    const [ff, fp] = await Promise.all([which("ffmpeg"), which("ffprobe")]);
    const ok = !!(ff && fp);
    return { content: [{ type: "text", text: JSON.stringify({
      ok,
      ffmpeg: ff || null,
      ffprobe: fp || null,
      install_hint: ok ? null : (process.platform === "darwin"
        ? "brew install ffmpeg"
        : (process.platform === "win32"
          ? "winget install Gyan.FFmpeg  (or download https://ffmpeg.org/download.html and add bin/ to PATH)"
          : "sudo apt install ffmpeg  (or see https://ffmpeg.org/download.html)")),
    }, null, 2) }] };
  }

  if (name === "video_info") {
    const v = validateAbsPath(args.path, { mustExist: true, purpose: "path" });
    if (v.err) return { isError: true, content: [{ type: "text", text: v.err }] };
    const fp = await which("ffprobe");
    if (!fp) return { isError: true, content: [{ type: "text", text: "ffprobe not found on PATH. Call check_ffmpeg for install hints." }] };
    try {
      const { stdout } = await execFileAsync(fp, [
        "-v", "error",
        "-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate,duration:format=duration,size,format_name,bit_rate",
        "-of", "json",
        v.ok
      ], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
      const probe = JSON.parse(stdout);
      const streams = probe.streams || [];
      const video = streams.find((s) => s.codec_type === "video") || {};
      const audio = streams.find((s) => s.codec_type === "audio") || null;
      const dur = Number((probe.format && probe.format.duration) || video.duration || 0);
      const fpsParts = (video.r_frame_rate || "0/1").split("/");
      const fps = fpsParts.length === 2 ? Number(fpsParts[0]) / Number(fpsParts[1]) : 0;
      const stat = fs.statSync(v.ok);
      return { content: [{ type: "text", text: JSON.stringify({
        path: v.ok,
        ext: path.extname(v.ok).toLowerCase(),
        size_bytes: stat.size,
        size_mb: Number((stat.size / 1048576).toFixed(2)),
        format: (probe.format && probe.format.format_name) || null,
        duration_sec: Number(dur.toFixed(3)),
        duration_hms: formatDuration(dur),
        video: video.codec_name ? {
          codec: video.codec_name,
          width: video.width || null,
          height: video.height || null,
          fps: Number((fps || 0).toFixed(3)),
          resolution: video.width && video.height ? `${video.width}x${video.height}` : null,
        } : null,
        has_audio: !!audio,
        audio_codec: audio ? audio.codec_name : null,
      }, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "ffprobe failed: " + (e.stderr || e.message) }] };
    }
  }

  if (name === "trim_video") {
    const inV = validateAbsPath(args.input, { mustExist: true, purpose: "input" });
    if (inV.err) return { isError: true, content: [{ type: "text", text: inV.err }] };
    const ext = path.extname(inV.ok).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) return { isError: true, content: [{ type: "text", text: `Unsupported video ext: ${ext}. Expected one of ${Array.from(VIDEO_EXTS).join(", ")}` }] };
    const start = String(args.start || "").trim();
    const end = String(args.end || "").trim();
    if (!start || !end) return { isError: true, content: [{ type: "text", text: "start and end are required." }] };
    const out = args.output
      ? validateAbsPath(args.output, { purpose: "output" })
      : { ok: path.join(path.dirname(inV.ok), path.basename(inV.ok, ext) + "-trim" + ext) };
    if (out.err) return { isError: true, content: [{ type: "text", text: out.err }] };
    if (!fs.existsSync(path.dirname(out.ok))) return { isError: true, content: [{ type: "text", text: "output directory does not exist: " + path.dirname(out.ok) }] };
    const ff = await which("ffmpeg");
    if (!ff) return { isError: true, content: [{ type: "text", text: "ffmpeg not found on PATH. Call check_ffmpeg for install hints." }] };
    const reencode = !!args.reencode;
    const ffArgs = [
      "-y", "-hide_banner", "-loglevel", "error",
      "-ss", start,
      "-to", end,
      "-i", inV.ok,
    ];
    if (reencode) {
      ffArgs.push("-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-b:a", "160k");
    } else {
      ffArgs.push("-c", "copy", "-avoid_negative_ts", "1");
    }
    ffArgs.push(out.ok);
    try {
      const t0 = Date.now();
      await execFileAsync(ff, ffArgs, { timeout: 5 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
      const stat = fs.statSync(out.ok);
      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        output: out.ok,
        size_mb: Number((stat.size / 1048576).toFixed(2)),
        elapsed_ms: Date.now() - t0,
        mode: reencode ? "reencode" : "stream-copy",
        start, end,
      }, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "ffmpeg trim failed: " + (e.stderr || e.message) }] };
    }
  }

  if (name === "extract_thumbnail") {
    const inV = validateAbsPath(args.input, { mustExist: true, purpose: "input" });
    if (inV.err) return { isError: true, content: [{ type: "text", text: inV.err }] };
    const time = String(args.time || "00:00:02");
    const width = Math.max(64, Math.min(4096, Number(args.width) || 1280));
    const defOut = path.join(path.dirname(inV.ok), path.basename(inV.ok, path.extname(inV.ok)) + "-thumb.jpg");
    const out = args.output ? validateAbsPath(args.output, { purpose: "output" }) : { ok: defOut };
    if (out.err) return { isError: true, content: [{ type: "text", text: out.err }] };
    const outExt = path.extname(out.ok).toLowerCase();
    if (!IMAGE_EXTS.has(outExt)) return { isError: true, content: [{ type: "text", text: `Unsupported output ext: ${outExt}. Use .jpg / .png / .webp.` }] };
    if (!fs.existsSync(path.dirname(out.ok))) return { isError: true, content: [{ type: "text", text: "output directory does not exist: " + path.dirname(out.ok) }] };
    const ff = await which("ffmpeg");
    if (!ff) return { isError: true, content: [{ type: "text", text: "ffmpeg not found on PATH. Call check_ffmpeg for install hints." }] };
    const ffArgs = [
      "-y", "-hide_banner", "-loglevel", "error",
      "-ss", time,
      "-i", inV.ok,
      "-frames:v", "1",
      "-vf", `scale=${width}:-2`,
      "-q:v", "2",
      out.ok,
    ];
    try {
      const t0 = Date.now();
      await execFileAsync(ff, ffArgs, { timeout: 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
      const stat = fs.statSync(out.ok);
      return { content: [{ type: "text", text: JSON.stringify({
        ok: true,
        output: out.ok,
        width,
        time,
        size_kb: Number((stat.size / 1024).toFixed(1)),
        elapsed_ms: Date.now() - t0,
      }, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "ffmpeg thumbnail failed: " + (e.stderr || e.message) }] };
    }
  }

  if (name === "push_journey") {
    const j = args.journey;
    const mode = args.mode === "append" ? "append" : "replace";
    if (!j || !j.title || !Array.isArray(j.modules)) {
      return { isError: true, content: [{ type: "text", text: "journey must include title and modules[]." }] };
    }
    // Normalize modules
    const VALID_TYPES = new Set(["intro", "core", "scorm", "assess", "reflect"]);
    const allIds = new Set(HTML_COMPS.concat(SCORM_COMPS).map((c) => c.id));
    const modules = j.modules.map((m, i) => {
      const comps = Array.isArray(m.components) ? m.components.filter((x) => allIds.has(x)) : [];
      return {
        id: "m_srv_" + Date.now() + "_" + i,
        title: String(m.title || `Module ${i + 1}`),
        type: VALID_TYPES.has(m.type) ? m.type : "core",
        duration: Math.max(0, parseInt(m.duration) || 5),
        components: comps,
        notes: String(m.notes || ""),
      };
    });
    const payload = {
      type: "journey_push",
      mode,
      journey: {
        title: String(j.title),
        audience: String(j.audience || ""),
        modules,
      },
      ts: Date.now(),
    };
    const delivered = broadcast(payload);
    if (delivered === 0) {
      queueForNextClient(payload);
      openBrowser(`http://localhost:${HTTP_PORT}/#journey`);
      return {
        content: [{
          type: "text",
          text: `No toolkit tab was open. Opened http://localhost:${HTTP_PORT}/ and queued the journey '${j.title}' (${modules.length} modules) for delivery on connect.`,
        }],
      };
    }
    return {
      content: [{ type: "text", text: `Pushed journey '${j.title}' (${modules.length} modules, ${mode}) to ${delivered} toolkit tab(s).` }],
    };
  }

  if (name === "ingest_source") {
    const v = validateAbsPath(args.path, { mustExist: true, purpose: "path" });
    if (v.err) return { isError: true, content: [{ type: "text", text: v.err }] };
    const ext = path.extname(v.ok).toLowerCase();
    if (!STORY_EXTS.has(ext)) {
      return { isError: true, content: [{ type: "text", text: `Unsupported source extension: ${ext}. Supported: ${[...STORY_EXTS].join(", ")}` }] };
    }
    try {
      const result = await ingestSourceFile(v.ok, Number(args.max_chunks) || 60);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "ingest_source failed: " + (e && e.message ? e.message : String(e)) }] };
    }
  }

  if (name === "draft_storyline") {
    const topic = String(args.topic || "").trim();
    const audience = String(args.audience || "").trim();
    const dur = Number(args.duration_min);
    if (!topic) return { isError: true, content: [{ type: "text", text: "topic is required." }] };
    if (!audience) return { isError: true, content: [{ type: "text", text: "audience is required." }] };
    if (!dur || dur < 3) return { isError: true, content: [{ type: "text", text: "duration_min must be a number >= 3." }] };
    try {
      const course = draftStorylinePure(args);
      return { content: [{ type: "text", text: JSON.stringify(course, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "draft_storyline failed: " + (e && e.message ? e.message : String(e)) }] };
    }
  }

  if (name === "assemble_storyline_docx") {
    const course = args.course;
    if (!course || typeof course !== "object" || !course.meta || !Array.isArray(course.modules)) {
      return { isError: true, content: [{ type: "text", text: "course is required (an object with meta and modules[]). Run draft_storyline first." }] };
    }
    const out = validateAbsPath(args.output_path, { purpose: "output_path" });
    if (out.err) return { isError: true, content: [{ type: "text", text: out.err }] };
    if (path.extname(out.ok).toLowerCase() !== ".docx") {
      return { isError: true, content: [{ type: "text", text: "output_path must end with .docx" }] };
    }
    if (!fs.existsSync(path.dirname(out.ok))) {
      return { isError: true, content: [{ type: "text", text: "output directory does not exist: " + path.dirname(out.ok) }] };
    }
    try {
      const t0 = Date.now();
      const r = await buildStorylineDocx(course, out.ok);
      return { content: [{ type: "text", text: JSON.stringify({
        ...r,
        elapsed_ms: Date.now() - t0,
        modules: (course.modules || []).length,
        lessons: (course.modules || []).reduce((a, m) => a + (m.lessons || []).length, 0),
      }, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "assemble_storyline_docx failed: " + (e && e.message ? e.message : String(e)) }] };
    }
  }

  return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ---------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------
// Graceful port-collision handling: if 7724 is already taken (e.g. another
// bcg-toolkit instance is running, or the user has both the .dxt and a
// dev-path mcpServers entry), we DON'T crash. The MCP stdio side stays
// alive and tool calls keep working — open_in_toolkit just hits the
// already-running server on the same port. This stops Claude Desktop from
// showing "Server disconnected" toasts on every login.
let httpBound = false;
httpServer.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    process.stderr.write(
      `[bcg-toolkit-mcp] port ${HTTP_PORT} already in use — assuming another bcg-toolkit instance owns it; staying alive in stdio-only mode.\n`
    );
    return; // swallow; do NOT exit
  }
  process.stderr.write(`[bcg-toolkit-mcp] http server error: ${err && err.message}\n`);
});
httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
  httpBound = true;
  // NOTE: do not write to stdout — MCP uses stdio for framing. Log to stderr.
  process.stderr.write(`[bcg-toolkit-mcp] http+ws listening on http://127.0.0.1:${HTTP_PORT}\n`);
});

const transport = new StdioServerTransport();
mcp.connect(transport).then(() => {
  process.stderr.write("[bcg-toolkit-mcp] MCP stdio ready" + (httpBound ? "" : " (stdio-only — port busy)") + "\n");
}).catch((err) => {
  process.stderr.write("[bcg-toolkit-mcp] MCP connect failed: " + err.message + "\n");
  process.exit(1);
});
