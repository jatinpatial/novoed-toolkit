#!/usr/bin/env node
// Build script: assembles a Desktop Extension (.dxt) from the live toolkit + MCP server.
//
// Usage: node dxt/build.js
//
// Produces: dxt/bcg-toolkit.dxt
//
// Layout of the packed extension:
//   manifest.json
//   server/
//     server.js      (copy of mcp-server/server.js)
//     catalog.js
//     package.json
//     node_modules/  (installed --production)
//   toolkit/
//     index.html     (snapshot of current full-package/index.html)
//     bcg-icons.js
//     fonts/         (if present)
//
// Why snapshot the toolkit? So the installed DXT is self-contained and the LD's
// version doesn't break when we push unrelated changes to main.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DXT_DIR = __dirname;                           // dxt/ — has manifest.json
const BUILD_DIR = path.join(DXT_DIR, "build");       // dxt/build/ — assembled extension
const OUT_FILE = path.join(DXT_DIR, "bcg-toolkit.dxt");

function log(msg) { process.stdout.write(`[dxt-build] ${msg}\n`); }

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, { skip = [] } = {}) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, { skip });
    else copyFile(s, d);
  }
}

// ── 1. Clean the build directory ───────────────────────────────────────────
log("cleaning build dir");
rimraf(BUILD_DIR);
rimraf(OUT_FILE);
fs.mkdirSync(BUILD_DIR, { recursive: true });

// ── 2. Copy manifest ───────────────────────────────────────────────────────
log("copying manifest.json");
copyFile(path.join(DXT_DIR, "manifest.json"), path.join(BUILD_DIR, "manifest.json"));

// ── 3. Copy MCP server source (excluding node_modules, smoke test, .env) ───
log("copying MCP server source");
const srcServer = path.join(ROOT, "mcp-server");
const destServer = path.join(BUILD_DIR, "server");
copyDir(srcServer, destServer, {
  skip: ["node_modules", ".env", "smoke.js", "*.log"],
});

// ── 4. Install production deps inside the packed server ────────────────────
log("installing production dependencies (npm install --omit=dev)");
execSync("npm install --omit=dev --no-audit --no-fund --silent", {
  cwd: destServer,
  stdio: "inherit",
});

// ── 5. Copy toolkit assets (index.html, icons, fonts) ──────────────────────
log("copying toolkit assets");
const destToolkit = path.join(BUILD_DIR, "toolkit");
fs.mkdirSync(destToolkit, { recursive: true });
for (const name of ["index.html", "bcg-icons.js"]) {
  const s = path.join(ROOT, name);
  if (fs.existsSync(s)) copyFile(s, path.join(destToolkit, name));
}
const fontsSrc = path.join(ROOT, "fonts");
if (fs.existsSync(fontsSrc)) copyDir(fontsSrc, path.join(destToolkit, "fonts"));

// ── 6. Pack via `dxt pack` ─────────────────────────────────────────────────
log("packing .dxt via @anthropic-ai/dxt");
execSync(`npx -y -p @anthropic-ai/dxt dxt pack "${BUILD_DIR}" "${OUT_FILE}"`, {
  stdio: "inherit",
  shell: true,
});

// ── 7. Report ──────────────────────────────────────────────────────────────
const stat = fs.statSync(OUT_FILE);
log(`✔ built ${path.relative(ROOT, OUT_FILE)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
log("");
log("Install in Claude Desktop: Settings → Extensions → drag the .dxt onto the window.");
