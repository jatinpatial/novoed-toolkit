# BCG U Studio — MCP bridge for Claude Desktop

This is the **MVP bridge** between Claude Desktop and BCG U Studio
(`../index.html`). It lets a Learning Designer do this in a normal Claude chat:

> _"Draft a 3-card summary of 'AI maturity phases' and open it in the toolkit."_

Claude calls `list_components` to find the right component, calls
`open_in_toolkit` with a filled-in payload, and the Studio tab loads the
component live — ready for the LD to tweak, re-brand, and export to HTML or
SCORM for any LMS.

**No API keys.** Claude Desktop uses the LD's existing subscription. The bridge
runs entirely on the LD's own machine.

## What it does

- Spawns a local MCP server (stdio transport) that Claude Desktop talks to.
- Serves the toolkit's `index.html` at **http://localhost:7724/**.
- Opens a **WebSocket** at `ws://localhost:7724/ws`. When the toolkit page is
  loaded from that URL, it connects automatically and shows "● MCP connected"
  in the bottom-right corner.
- Exposes three MCP tools:
  - **`list_components`** — catalog of all 31 HTML + 16 SCORM components,
    with schemas and examples.
  - **`open_in_toolkit(comp, data, brand?)`** — pushes a component payload
    into the running toolkit tab. If no tab is open, opens one.
  - **`toolkit_status`** — diagnostic: is the server up, how many browser
    tabs connected, any queued push.

## Prerequisites

- Node.js **≥ 18** (check with `node --version`).
- **Claude Desktop** installed from [claude.ai/download](https://claude.ai/download).
- Your Claude.ai subscription (Pro, Team, or Enterprise).

## Install

```bash
cd "C:\Work\Claude Code\full-package\mcp-server"
npm install
```

## Wire up Claude Desktop

Open the Claude Desktop config file:

**Windows**

```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS**

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file doesn't exist, create it. Add the `bcg-toolkit` entry:

```json
{
  "mcpServers": {
    "bcg-toolkit": {
      "command": "node",
      "args": ["C:\\Work\\Claude Code\\full-package\\mcp-server\\server.js"]
    }
  }
}
```

On macOS the `args` path would be e.g. `"/Users/jatin/work/full-package/mcp-server/server.js"`.

**Escape backslashes** on Windows — use `\\` not `\`.

Fully quit and relaunch Claude Desktop. In a new chat you should see a 🔌
plug icon or a tools indicator; clicking it lists `list_components`,
`open_in_toolkit`, `toolkit_status`.

## Try it

In Claude Desktop:

> _Use the bcg-toolkit. Draft a "cards" component with 3 cards summarising the
> three phases of AI maturity (explore → scale → transform) and open it in
> the toolkit._

Claude will:

1. Call `list_components` to see the `cards` schema.
2. Call `open_in_toolkit` with `comp: "cards"` and `data: { items: [...] }`.
3. Your default browser opens http://localhost:7724/. The cards component
   loads pre-filled. A green "● MCP connected" chip shows in the bottom right.

From there: edit fields in the left panel, switch brand, copy the HTML to
any LMS (Rise, NovoEd, Docebo, Moodle, Canvas), or download a self-editing
SCORM 1.2 zip for any SCORM-compatible platform.

## Smoke test (no Claude Desktop required)

Verifies the server starts, tools respond, and WebSocket push works:

```bash
npm run smoke
```

Expect 6 "OK" lines.

## Environment

- `BCG_TOOLKIT_PORT` — override the default `7724`.

## Architecture notes

- The toolkit **stays standalone**. The MCP client code in `index.html` only
  tries to connect when served from `localhost`/`127.0.0.1`. Deployed copies
  (GitHub Pages, SharePoint) run exactly as before.
- The server **never writes to `index.html`**. It only serves it and pushes
  data via WebSocket. Round-tripping (LD edits → Claude reads) is out of scope
  for CP0 — it would need a `read_state` tool and is deferred to CP1+.
- If you call `open_in_toolkit` with no browser tab open, the server opens a
  tab and queues the push — the queued payload is replayed when the tab
  finishes connecting.

## Known CP0 limits (on the roadmap)

- **One-way push only.** Claude pushes to the toolkit. To let Claude read what
  the LD edited, we need a `read_state` tool (CP1).
- **Single brand per push.** Multi-component "journey" composition comes in
  CP3 (`design_journey` + `generate_module`).
- **Hand-maintained catalog.** `catalog.js` duplicates schemas from
  `index.html`. Acceptable at 47 components; at 100+ we'd auto-extract.
- **No image generation yet.** CP1 will add `generate_image_prompt` (Images 2.0
  prompt scaffolding).
