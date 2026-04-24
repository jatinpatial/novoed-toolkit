# BCG U Studio — Desktop Extension (DXT)

Packages the MCP server + Studio HTML into a **single `.dxt` file** that Learning Designers can install into Claude Desktop with one click — no Node install, no JSON config editing, no command line. Outputs work in any LMS (Rise, NovoEd, Docebo, Moodle, Canvas — any SCORM-compatible platform).

## Build the .dxt

```powershell
cd "C:\Work\Claude Code\full-package"
node dxt/build.js
```

Output: `dxt/bcg-toolkit.dxt` (a signed-zip archive).

## Install for an LD

1. Send the LD the `.dxt` file (or link to it on SharePoint / GitHub releases).
2. LD opens **Claude Desktop → Settings → Extensions**.
3. **Drag the .dxt onto the window.** Click **Install**.
4. That's it. In a new chat they can immediately say "Use the bcg-toolkit to draft a 3-card summary of X" and it works.

## What's inside the .dxt

```
manifest.json          — DXT metadata, entry point, tool list
server/
  server.js            — MCP stdio + HTTP + WebSocket server
  catalog.js           — 31 HTML + 16 SCORM component definitions
  package.json         — runtime deps (@modelcontextprotocol/sdk, ws)
  node_modules/        — bundled production deps
toolkit/
  index.html           — the Studio UI (snapshot of main repo)
  bcg-icons.js         — BCG icon set
  fonts/               — Henderson .woff2 + README (fonts activate when files present)
```

## Updating an installed extension

Build a new `.dxt`, drop the new version number in `manifest.json`, and distribute. Claude Desktop supports side-by-side install of different versions — new one wins.

## Signing (optional, post-MVP)

```powershell
npx -p @anthropic-ai/dxt dxt sign bcg-toolkit.dxt --cert path/to/bcg-code-sign.pfx
```

Needs a BCG-issued code-signing cert. Unsigned `.dxt` files install fine — signing just removes the "unknown publisher" warning.

## Dev vs DXT parity

The MCP server source lives at `mcp-server/` and is the source of truth. `dxt/build.js` copies it into `dxt/build/` at build time. The server's path resolution is layout-adaptive — it finds `index.html` whether it's running from the dev folder or the DXT's `toolkit/` subfolder (see `TOOLKIT_CANDIDATES` in `server.js`).
