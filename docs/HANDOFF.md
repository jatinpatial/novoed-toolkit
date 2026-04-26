# BCG U Studio — Handoff

This document is the single source of truth for the current architecture
and Phase 1 plan. The next chat session should read this in full before
touching code. It supersedes `ARCHITECTURE.md` (which describes the old
single-file `index.html` toolkit phase).

---

## 1. Product in one sentence

**BCG U Studio is a chat-led, AI-powered course-building tool for BCG U
Learning Designers — turns a topic + audience + duration into a
weekly-structured course (modules → lessons → components) ready to
deploy on NovoEd or export as a Rise SCORM zip.**

The LD chats with the tool. The tool calls Claude (via the LD's own
subscription, no API key) with specialized prompts for each task. The
result is a fully-structured course they can edit, preview, and export.

---

## 2. The audience and their day

**Who:** ~10 BCG U Learning Designers, non-technical, on Windows laptops.

**What they do today:**
- Receive course requests from case teams or clients
- Build NEW courses from scratch (this product is greenfield-only — we
  do NOT touch existing flagship programs)
- Use ChatGPT for content writing, scripting, Q&A
- Use Genially for animated/interactive infographics
- Use PowerPoint for static infographics (export as PNG, drop in)
- Use Synthesia for talking-head and narration videos
- Hand off to NovoEd (LMS — admin publishes one module per week) OR
  package as a Rise SCORM zip for the client's own LMS

**Where they get stuck:**
- Writing every component from scratch
- Designing infographics
- Generating quality video scripts (Synthesia's own AI is poor)
- Adding everything into NovoEd / Rise

**"Done" looks like:**
- A SCORM zip they hand to a client (Rise path), or
- A NovoEd course link with weekly admin-controlled releases

**Touchpoints:** PMs, SMEs, video editors all touch the course at various
points. **The LD is the one who creates videos themselves.** Multi-user
review/approval is NOT v1 scope.

---

## 3. Architecture — three pieces talking to each other

```
   ┌───────────────────────────────────────────────────────┐
   │  Internet  (free static hosting — GH Pages /          │
   │            SharePoint / Cloudflare Pages)             │
   │  ┌─────────────────────────────────────────────────┐  │
   │  │  app/  — React + Vite + Tailwind                │  │
   │  │  Routes: /, /courses, /infographics, /player,   │  │
   │  │          /projects                              │  │
   │  │  Already wired: AgentChat, AgentContext,        │  │
   │  │     ToolBridge socket, course data model,       │  │
   │  │     SCORM zip builder, brand tokens             │  │
   │  └─────────────────────────────────────────────────┘  │
   └─────────────────────────┬─────────────────────────────┘
                             │ WebSocket (ws://localhost:8766/ws)
                             ▼
   ┌───────────────────────────────────────────────────────┐
   │  LD's laptop                                          │
   │  ┌─────────────────────────────────────────────────┐  │
   │  │  agent-backend/  — Python + FastAPI             │  │
   │  │  • claude_agent_sdk runs Claude via the LD's    │  │
   │  │    subscription (Claude Code CLI subprocess)    │  │
   │  │  • Custom MCP server defines UI tools           │  │
   │  │  • ToolBridge: agent calls tool → bridge sends  │  │
   │  │    over WS to React → React executes → returns  │  │
   │  │  • Streaming responses appear in chat in real   │  │
   │  │    time                                         │  │
   │  └─────────────────────────────────────────────────┘  │
   │                          │                            │
   │                          │ child process              │
   │                          ▼                            │
   │  ┌─────────────────────────────────────────────────┐  │
   │  │  Claude Code CLI  (npm install -g @anthropic-   │  │
   │  │  ai/claude-code)                                │  │
   │  │  Authenticates via the LD's Claude subscription │  │
   │  │  — same login they use for Claude Desktop       │  │
   │  └─────────────────────────────────────────────────┘  │
   │                                                       │
   │  ┌─────────────────────────────────────────────────┐  │
   │  │  mcp-server/  — Node MCP server (legacy)        │  │
   │  │  Exposes 12 tools: list_components,             │  │
   │  │    open_in_toolkit, ingest_source,              │  │
   │  │    draft_storyline, assemble_storyline_docx,    │  │
   │  │    check_ffmpeg, video_info, trim_video,        │  │
   │  │    extract_thumbnail, push_journey,             │  │
   │  │    suggest_component, toolkit_status            │  │
   │  │  Status: 11/11 smoke tests pass.                │  │
   │  │  Future: agent-backend may call these directly  │  │
   │  │  (Python ↔ Node MCP) OR absorb their logic.     │  │
   │  └─────────────────────────────────────────────────┘  │
   └───────────────────────────────────────────────────────┘
```

**Cost model:**
- Static hosting: free (GH Pages, SharePoint, Cloudflare)
- LLM: zero per-token cost (each LD's own Claude subscription via Claude
  Code CLI)
- Server: nothing — there is no central server

**Key architectural decisions (locked in):**
1. **No Claude API.** Subscription auth via Claude Code CLI only.
2. **Module = week.** The LMS publishing cadence drives the data model.
3. **Greenfield only.** No "import & update existing course" flow in v1.
4. **Single-LD per session.** No multiplayer / approvals in v1.
5. **Two delivery targets:** SCORM zip (Rise) and NovoEd-ready bundle.

---

## 4. The five agents (LD never picks one — orchestrator routes)

| Agent | When it fires | What it produces |
|---|---|---|
| **Course Architect** | LD types topic + audience + duration | Course skeleton: N weekly modules, 2-4 lessons each, learning objectives, 2-3 case-study slots |
| **Lesson Writer** | LD opens an empty lesson and asks "fill this in" | Body copy in BCG U voice, 8th-grade reading level, action-first phrasing |
| **Synthesia Scriptwriter** | LD adds a video block | Avatar-paced script (~150 wpm), short sentences (<12 words), `[PAUSE]` markers, on-screen text suggestions, B-roll cues |
| **Quiz Builder** | Lesson-level knowledge check OR module-level final assessment | MCQs with distractors, rationales, optional short-answer items, Bloom's-aware difficulty |
| **Case Study Designer** | Module-level scenario | Realistic BCG-style case with stakeholder voices, decision points, debrief prompts |

**Orchestrator behavior:** the LD's chat input is parsed by a top-level
agent (lightweight system prompt) that decides which sub-agent to dispatch
to. The LD just types in plain language. All five sub-agents share access
to the course tree via `list_structure`, `add_module`, `add_lesson`,
`add_block`, `update_block`.

---

## 5. Data model (TypeScript)

```ts
type Course = {
  id: string;
  meta: {
    title: string;
    audience: { role: string; seniority: string; industry: string };
    learnerCount: number;
    objectives: string[];        // 3-7 measurable outcomes
    durationWeeks: number;       // = number of modules
    delivery: "novoed" | "rise";
  };
  modules: Module[];
  caseStudies: CaseStudy[];      // 2-3 per course
  rawSources: RawSource[];       // ingested decks/docs
  brand: "bcg" | "bcgu" | "custom";
};

type Module = {
  id: string;
  weekNumber: number;            // 1, 2, 3...
  title: string;
  summary: string;               // shown on NovoEd module card
  objectives: string[];
  lessons: Lesson[];             // 2-4 per module
  knowledgeCheck: Quiz;          // module-level final
  caseStudyId?: string;          // ref into Course.caseStudies
};

type Lesson = {
  id: string;
  title: string;                 // "1.1 Why change is hard"
  durationMin: number;           // 8-15 typically
  blocks: Block[];               // ordered content components
  videoScript?: VideoScript;     // optional Synthesia script
  knowledgeCheck?: Quiz;         // optional lesson-level
};

type Block =
  | { type: "text"; body: string /* markdown */ }
  | { type: "html"; componentId: string; data: any }   // ref into 31-comp catalog
  | { type: "scorm"; activityId: string; data: any }   // ref into 16-activity catalog
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "video"; provider: "synthesia" | "embed"; embedUrl?: string; script?: VideoScript }
  | { type: "infographic"; suggestedTool: "genially" | "ours"; brief: string };

type VideoScript = {
  totalDurationSeconds: number;
  scenes: Scene[];
};

type Scene = {
  durationSeconds: number;
  spokenText: string;
  onScreenText?: string;
  bRoll?: string;
  pauseAfterSeconds?: number;
};

type Quiz = {
  questions: QuizQuestion[];
};

type QuizQuestion =
  | { type: "mcq"; stem: string; options: string[]; correctIndex: number; rationale: string }
  | { type: "short"; stem: string; expectedAnswerHints: string[] };

type CaseStudy = {
  id: string;
  title: string;
  context: string;
  stakeholders: { name: string; role: string; voice: string }[];
  decisionPoints: string[];
  debriefPrompts: string[];
};

type RawSource = {
  id: string;
  filename: string;
  type: "pptx" | "pdf" | "docx" | "md" | "txt";
  chunks: { title: string; body: string; speakerNotes?: string }[];
};
```

`app/src/course/types.ts` already has a `Block`, `Course`, `Lesson`,
`Module` shape. Use that as the starting point — it may need extensions
for `meta`, `caseStudies`, `rawSources`, `videoScript`, `knowledgeCheck`.

---

## 6. Screens

### 6.1 Dashboard (`/`)
"What course are we building today?" — chat-first welcome with:
- Big input: "Topic of the course"
- Smaller fields: audience, learners, duration, delivery
- Drop zone: "Drag a deck/PDF if you have one (optional)"
- Big button: "Start with this brief"
- Below: list of recent courses (from `app/src/store/projects.ts`)

### 6.2 Course Studio (`/courses?id=…`) — the main workspace

Three-pane layout:

```
┌────────────┬───────────────────────────┬──────────────────────┐
│  COURSE    │  CHAT                     │  LIVE PREVIEW         │
│  TREE      │                           │                       │
│            │  > make week 2 about      │  [Lesson 1.1]         │
│  Course    │    stakeholder mapping    │  Why change is hard   │
│  ▼ Week 1  │                           │                       │
│   ▶ 1.1    │  Course Architect:        │  [Banner]             │
│   ▶ 1.2    │  Drafted Module 2 with    │  Change costs more    │
│  ▶ Week 2  │  3 lessons. Want me to    │  than people think    │
│  ▶ Week 3  │  expand the lessons?      │                       │
│  ▶ Week 4  │                           │  [Cards × 3]          │
│            │  [yes, go]   [refine]     │  • Cost  • Risk  ...  │
│  + Module  │                           │                       │
│            │  > [type message...]      │  [Quiz × 4 MCQs]      │
└────────────┴───────────────────────────┴──────────────────────┘
```

`CourseStudio.tsx` already has most of this scaffolded. Phase 1 is
making it the real LD-facing flow.

### 6.3 Component Library (`/library`)
Browse the 47 components (31 HTML + 16 SCORM). Pick one → opens a config
panel → adds to the current lesson. Already mostly built in
`ComponentLibrary.tsx`.

### 6.4 Infographic Studio (`/infographics`)
For the "static-PPT" replacement path. Brand-themed, exported as PNG or
embeddable HTML. `InfographicStudio.tsx` exists; verify it matches the LD
infographic patterns.

### 6.5 SCORM Player (`/player?id=…`)
Preview a generated SCORM zip locally before exporting. Already exists.

### 6.6 Projects Library (`/projects`)
List of saved courses. Open / duplicate / delete. Already exists.

---

## 7. Phase 1 — six concrete commits

The goal of Phase 1 is **one LD typing a brief and getting a structured
course back, end-to-end, in the browser, with no claude.ai redirect.**

| # | Commit | Outcome |
|---|---|---|
| 1 | **Wire run config + smoke test** | `python run.py` starts agent-backend on :8766 ; `npm run dev` in `app/` starts Vite on :5173 ; CORS configured ; AgentChat connects WS and shows "connected" |
| 2 | **Course Architect agent** | First specialized system prompt + sub-agent registration. "I want a 6-week change management course for senior managers" → outline appears as proposed text, with a "build this" button that calls `add_module` × 6 |
| 3 | **Lesson Writer + dragdrop ingest** | Lessons can be filled in via "fill this lesson" command. PPTX/PDF drop zone in chat triggers `ingest_source` (call the Node mcp-server tool from Python). |
| 4 | **Synthesia Scriptwriter** | "Add a 90-second avatar video to lesson 1.1 explaining the cost-of-change framework" produces a `VideoScript` object, renders as a copyable script panel. |
| 5 | **Quiz Builder + Case Study Designer** | Module-level final + 2 course-level case studies generated and added to the tree. |
| 6 | **Two exporters** | "Export to SCORM zip" and "Export NovoEd bundle" both run. SCORM zip plays in `ScormPlayer`. |

After Phase 1, you have a real demo: type a brief, get a structured
course, export it. Phase 2 is polish (preview fidelity, infographic
generation, brand theming, installer for the 10-LD pilot).

---

## 8. What's already wired vs what needs building

### Already wired (don't rebuild)
- **`app/src/agent/AgentContext.tsx`** — provides `useAgent` + tool action registration
- **`app/src/agent/AgentChat.tsx`** — chat UI component (~5KB)
- **`app/src/agent/useAgentSocket.ts`** — WebSocket connection to agent-backend
- **`app/src/agent/toolExecutor.ts`** — runs tool calls in the React app
- **`app/src/course/types.ts`** — Block, Course, Lesson, Module types
- **`app/src/course/blockTypes.ts`** — block type registry
- **`app/src/course/exportLesson.ts`** — exportLessonSCORM, exportCourseJSON, exportOutlineText
- **`app/src/course/previewBlock.ts`** — block-to-HTML preview
- **`app/src/scorm/zipBuilder.ts`** — SCORM zip generation
- **`app/src/scorm/player.ts`** — SCORM in-browser player
- **`app/src/store/projects.ts`** — localStorage project persistence
- **`app/src/brand/tokens.ts`** — BCG/BCG U/Custom theme tokens
- **`app/src/pages/CourseStudio.tsx`** — main workspace, AgentChat already imported
- **`app/src/pages/Dashboard.tsx`**, `ComponentLibrary.tsx`, `InfographicStudio.tsx`,
  `ScormPlayer.tsx`, `ProjectsLibrary.tsx` — pages exist
- **`agent-backend/agent_backend/session.py`** — ClaudeSDKClient with ToolBridge
- **`agent-backend/agent_backend/ui_tools.py`** — UI tools (navigate, set_brand, list_structure, add_module, etc.)
- **`agent-backend/agent_backend/config.py`** — SYSTEM_PROMPT (generic, needs LD specialization)
- **`agent-backend/agent_backend/bridge.py`** — async tool call bridging
- **`mcp-server/server.js`** — 12 MCP tools, 11/11 smoke tests passing

### Needs building (Phase 1)
- LD-specific orchestrator prompt + 5 specialized sub-agent prompts
- Drag-drop file ingest into the chat (UI + bridge to mcp-server's `ingest_source`)
- The Course Architect's "propose outline → user confirms → build it" two-step
- Synthesia script renderer in the preview pane
- NovoEd export bundle format (manifest + HTML pages organized by week)
- A polished Dashboard `/` that's actually the welcome experience
- Component palette inside Course Studio: agent's "add a flip card" maps to the right component generator

### Decision needed (not blocking Phase 1)
- Does agent-backend call mcp-server tools via Node spawn, or absorb the
  logic into Python? Easier path: spawn for now, absorb later.
- Where to host the React app for the 10-LD pilot? GH Pages public, GH Pages
  private, BCG SharePoint, Azure Static Web App. Recommend: start with
  GH Pages private to a BCG-internal repo.

---

## 9. The 10-LD install path

Each LD does this once:
1. **Install Claude Code CLI** — `npm install -g @anthropic-ai/claude-code` and run `claude login` (OAuth via their Claude subscription)
2. **Install BCG U Studio backend** — single Windows installer (`.msi`) bundling Python + the agent-backend service. Sets it to run on login. *(Phase 2 deliverable; for the pilot, manual `pip install -e .` + `python run.py` is acceptable.)*
3. **Done.** Open the React app URL in their browser.

No Claude Desktop required (though they probably have it). No `.dxt`
required (though we keep it around as a transition path).

---

## 10. Repo file inventory

### Active working set
- `app/` — React frontend
- `agent-backend/` — Python LLM engine
- `mcp-server/` — Node MCP server with 12 tools
- `dxt/` — `.dxt` packaging (transition path for any LD who wants the
  legacy Claude Desktop flow)
- `docs/` — this file plus the leadership one-pager and demo script
- `fonts/` — font slot
- `bcg-icons.js` — 1,069 BCG icons (port into `app/src/icons/` then archive)
- `index.html` — legacy SPA. Functional today. Will retire after `app/`
  has full feature parity.
- `README.md` — needs rewrite to point at the new architecture (low priority)

### `_archive/now/` (already moved)
- `build_vanilla.py` — concatenated JSX into `index.html`
- `convert-icons.js` — generated `bcg-icons.js` (one-shot)
- `course-builder.html` — superseded by `app/src/pages/CourseBuilder.tsx`
- `procurement-infographic.html` — pre-toolkit demo

### Port-then-archive (still in repo, not yet archived)
- `index.html` — port components catalog into `app/src/generators/`, then archive
- `NovoEd_Component_Library.jsx` — original JSX of components; mine for any patterns missing in `app/src/generators/`, then archive
- `NovoEd_Toolkit_Claude_Project_Instructions.md` — old Claude Project prompt; extract reusable bits for new agent personas
- `ARCHITECTURE.md` — old toolkit design doc; this HANDOFF.md replaces it

---

## 11. First message for the new chat

Paste this into the new chat to bring the next session up to speed cold:

> I'm Jatin at BCG U. I'm building **BCG U Studio**, a chat-led
> AI-powered course-building tool for ~10 BCG U Learning Designers.
> The repo is at `C:\Work\Claude Code\full-package`.
>
> Read `docs/HANDOFF.md` first — it's the single source of truth for
> the architecture, the LD workflow, the data model, the agent personas,
> and the Phase 1 plan.
>
> After reading, do this:
> 1. Spot-check that the active working set (`app/`, `agent-backend/`,
>    `mcp-server/`) matches what's described.
> 2. Tell me back, in 6-8 bullets, what you understand the next concrete
>    commit to be (Phase 1 #1: Wire run config + smoke test).
> 3. Wait for my "go" before touching code.
>
> Constraints: subscription auth only (no Claude API), Module = Week,
> greenfield-only (no updating existing courses), 10-LD internal pilot.
