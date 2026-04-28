import type { Page, WebSocketRoute } from "@playwright/test";

/**
 * WebSocket interceptor for the agent backend protocol. Replaces the
 * real backend with a scripted sequence of tool_call + assistant_text
 * frames, so mocked tests run with vite alone — no Python, no LLM
 * cost, deterministic behavior.
 *
 * Protocol mirrors useAgentSocket.ts:
 *   Client → mock:  { type: "user_message", text } | { type: "tool_result", id, ok, result, error }
 *   Mock   → client: { type: "tool_call", id, name, args } | { type: "assistant_text", text } | { type: "done" }
 *
 * Each turn is described by an AgentTurnSpec. Specs are matched against
 * the user_message text (regex or substring); the first matching spec
 * runs and is consumed. The mock fires tool_calls one at a time,
 * waiting for the FE's tool_result before firing the next — same
 * shape the real backend exhibits.
 */

export interface MockedToolCall {
  /** Unprefixed tool name as seen by the FE dispatcher (e.g. "list_structure"). */
  name: string;
  /** Args sent on the tool_call frame. The FE dispatcher reads these. */
  args?: Record<string, unknown>;
}

export interface AgentTurnSpec {
  /** Pattern matched against the user_message text. Omit to match any. */
  userMessage?: RegExp | string;
  /** Tool calls fired in order; each waits for the FE's tool_result. */
  toolCalls?: MockedToolCall[];
  /** Final assistant_text frame, sent after all toolCalls land. */
  assistantText?: string;
}

export async function installAgentMock(page: Page, scripts: AgentTurnSpec[]): Promise<void> {
  // Local mutable copy — specs are consumed as they fire.
  const queue = scripts.slice();
  // Pending resolver per outstanding tool_call, keyed by the id we sent.
  const pendingResolvers = new Map<string, () => void>();

  // The agent connects to ws://127.0.0.1:8766/ws — a different origin
  // than the page (localhost:5173). The explicit URL keeps the matcher
  // unambiguous; routeWebSocket handles cross-origin connections fine.
  //
  // React 18 StrictMode double-mounts AgentProvider in dev: the first
  // mount opens a WS, the unmount cleanup closes it, the second mount
  // opens a fresh WS. useAgentSocket's reconnect timer also fires
  // periodically. The handler below is invoked for every WS the page
  // opens — keep it idempotent.
  await page.routeWebSocket("ws://127.0.0.1:8766/ws", (ws: WebSocketRoute) => {
    // Register onClose explicitly even though we don't act on it.
    // Without it, the page-side ws.onopen never fires for some
    // connections (Playwright behavior in 1.59 — needs a handler
    // registered before the route handler returns).
    ws.onClose(() => {});
    ws.onMessage((raw) => {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as unknown as ArrayBuffer);
      let msg: { type: string; [k: string]: unknown };
      try { msg = JSON.parse(text); } catch { return; }

      if (msg.type === "tool_result") {
        const id = String(msg.id ?? "");
        const resolver = pendingResolvers.get(id);
        if (resolver) {
          pendingResolvers.delete(id);
          resolver();
        }
        return;
      }

      if (msg.type === "user_message") {
        const userText = String(msg.text ?? "");
        const idx = queue.findIndex((s) => !s.userMessage || matches(s.userMessage, userText));
        if (idx === -1) {
          // No matching script — fail loudly so tests don't hang silently.
          ws.send(JSON.stringify({ type: "error", message: `[agentMock] no script for user_message: ${userText.slice(0, 80)}` }));
          ws.send(JSON.stringify({ type: "done" }));
          return;
        }
        const script = queue.splice(idx, 1)[0];
        void runScript(ws, script, pendingResolvers);
      }
    });
  });
}

function matches(pattern: RegExp | string, text: string): boolean {
  return pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);
}

async function runScript(
  ws: WebSocketRoute,
  script: AgentTurnSpec,
  pendingResolvers: Map<string, () => void>,
): Promise<void> {
  const calls = script.toolCalls ?? [];
  for (let i = 0; i < calls.length; i++) {
    const t = calls[i];
    const callId = `mock-${Date.now()}-${i}`;
    const ackPromise = new Promise<void>((resolve) => {
      pendingResolvers.set(callId, resolve);
    });
    ws.send(JSON.stringify({ type: "tool_call", id: callId, name: t.name, args: t.args ?? {} }));
    // Wait for the FE dispatcher to run its handler and respond with
    // tool_result before firing the next tool_call. Mirrors the real
    // backend's serial behavior.
    await ackPromise;
  }
  if (script.assistantText) {
    ws.send(JSON.stringify({ type: "assistant_text", text: script.assistantText }));
  }
  ws.send(JSON.stringify({ type: "done" }));
}
