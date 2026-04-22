// Smoke test — starts the MCP server as a child process, drives it over stdio
// the same way Claude Desktop would, and checks that list_components +
// open_in_toolkit respond correctly. Also verifies the HTTP server is up.
//
// Run with: node smoke.js
//
// This does NOT require Claude Desktop — it's a self-contained end-to-end check.

import { spawn } from "node:child_process";
import http from "node:http";
import { WebSocket } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.BCG_TOOLKIT_PORT || 7725); // use 7725 for smoke so we don't clash
const SERVER = path.join(__dirname, "server.js");

let child;
let nextId = 1;
const pending = new Map();

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    child.stdin.write(msg);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("timeout: " + method));
      }
    }, 5000);
  });
}

function waitHttp(url, tries = 20) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(url, (res) => { res.resume(); resolve(res.statusCode); })
        .on("error", () => {
          if (n <= 0) reject(new Error("http never came up"));
          else setTimeout(() => attempt(n - 1), 200);
        });
    };
    attempt(tries);
  });
}

(async function main() {
  child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, BCG_TOOLKIT_PORT: String(PORT) },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr.on("data", (b) => process.stderr.write("[server] " + b.toString()));

  let buf = "";
  child.stdout.on("data", (b) => {
    if (process.env.SMOKE_DEBUG) process.stderr.write("[stdout] " + b.toString());
    buf += b.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (e) { /* ignore */ }
    }
  });

  function pass(name) { console.log("  OK  " + name); }
  function fail(name, err) { console.error("  FAIL " + name + " — " + err.message); process.exitCode = 1; }

  try {
    // 1. initialize (MCP handshake)
    await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.0" },
    });
    pass("initialize");

    // 2. HTTP server listening
    const code = await waitHttp(`http://127.0.0.1:${PORT}/`);
    if (code !== 200) throw new Error("http status " + code);
    pass("http serves index.html");

    // 3. tools/list
    const tools = await rpc("tools/list", {});
    const names = (tools.tools || []).map((t) => t.name).sort();
    const expected = ["list_components", "open_in_toolkit", "toolkit_status"];
    for (const e of expected) if (!names.includes(e)) throw new Error("missing tool: " + e);
    pass("tools/list returns " + names.join(","));

    // 4. list_components
    const lc = await rpc("tools/call", { name: "list_components", arguments: { filter: "all" } });
    const text = lc.content?.[0]?.text || "";
    const parsed = JSON.parse(text);
    if (!parsed.html?.length) throw new Error("no html components");
    if (!parsed.scorm?.length) throw new Error("no scorm components");
    pass(`list_components returned ${parsed.html.length} html + ${parsed.scorm.length} scorm`);

    // 5. WebSocket — connect, then push via open_in_toolkit, expect to receive.
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const received = [];
    ws.on("message", (b) => { try { received.push(JSON.parse(b.toString())); } catch {} });
    await new Promise((r, rj) => { ws.on("open", r); ws.on("error", rj); });
    // drain the hello
    await new Promise((r) => setTimeout(r, 50));

    const pushResult = await rpc("tools/call", {
      name: "open_in_toolkit",
      arguments: {
        comp: "cards",
        brand: "bcg",
        data: { items: [{ title: "Smoke", desc: "Test push from smoke.js" }] },
      },
    });
    if (pushResult.isError) throw new Error("open_in_toolkit errored: " + pushResult.content?.[0]?.text);
    // wait a tick for the message
    await new Promise((r) => setTimeout(r, 150));
    const openMsg = received.find((m) => m.type === "open");
    if (!openMsg) throw new Error("websocket never received 'open' — received: " + JSON.stringify(received));
    if (openMsg.comp !== "cards") throw new Error("wrong comp: " + openMsg.comp);
    pass("open_in_toolkit delivered via websocket");

    // 6. unknown comp → error
    const bad = await rpc("tools/call", {
      name: "open_in_toolkit",
      arguments: { comp: "definitely_not_a_comp", data: {} },
    });
    if (!bad.isError) throw new Error("expected isError for bad comp");
    pass("unknown comp returns isError");

    ws.close();
  } catch (err) {
    fail("smoke", err);
  } finally {
    child.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 100);
  }
})();
