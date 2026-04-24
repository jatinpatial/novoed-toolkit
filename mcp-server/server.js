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
import { exec } from "node:child_process";
import { HTML_COMPS, SCORM_COMPS, SCHEMAS, EXAMPLES, BRANDS } from "./catalog.js";

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
];

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

  return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ---------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------
httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
  // NOTE: do not write to stdout — MCP uses stdio for framing. Log to stderr.
  process.stderr.write(`[bcg-toolkit-mcp] http+ws listening on http://127.0.0.1:${HTTP_PORT}\n`);
});

const transport = new StdioServerTransport();
mcp.connect(transport).then(() => {
  process.stderr.write("[bcg-toolkit-mcp] MCP stdio ready\n");
}).catch((err) => {
  process.stderr.write("[bcg-toolkit-mcp] MCP connect failed: " + err.message + "\n");
  process.exit(1);
});
