import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentActions } from "./AgentContext";
import type {
  BuildProgressKind,
  ClientMessage,
  ConnectionStatus,
  OrchestratorState,
  ServerMessage,
} from "./types";
import { dispatchToolCall } from "./toolExecutor";

interface UseAgentSocketArgs {
  url: string;
  getActions: () => AgentActions | null;
  onAssistantText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onError: (message: string) => void;
  onDone: () => void;
  // ── sprint-2-1: orchestrator event hooks ───────────────────────────
  onBuildState: (state: OrchestratorState) => void;
  onBuildProgress: (kind: BuildProgressKind, payload: Record<string, unknown>) => void;
  // ── Track-B (KC Studio): standalone build round-trip ──────────────
  onKcBuilt: (payload: {
    kcId: string;
    durationMs: number;
    initMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
    model: string | null;
    costUsd: number | null;
  }) => void;
  onKcBuildFailed: (kcId: string, error: string) => void;
  // ── Track-G (Infographic Studio): standalone build round-trip ────
  onInfographicBuilt: (payload: {
    infographicId: string;
    durationMs: number;
    initMs: number;
    tokensIn: number | null;
    tokensOut: number | null;
    model: string | null;
    costUsd: number | null;
  }) => void;
  onInfographicBuildFailed: (infographicId: string, error: string) => void;
}

export function useAgentSocket(args: UseAgentSocketArgs) {
  const { url } = args;
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(args);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  callbacksRef.current = args;

  useEffect(() => {
    let closed = false;
    let retryTimer: number | undefined;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("open");
        // sprint-2-1: rehydrate orchestrator state on every (re)connect
        // so the FE picks up where the backend left off after a refresh
        // or transient disconnect. Backend is the single source of
        // truth (locked fork #3).
        try {
          ws.send(JSON.stringify({ type: "get_orchestrator_state" } satisfies ClientMessage));
        } catch {
          // best-effort — if the send fails the build_state we receive
          // on the next interaction will catch us up anyway.
        }
      };

      ws.onmessage = async (e) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        const cb = callbacksRef.current;

        if (msg.type === "assistant_text") {
          cb.onAssistantText(msg.text);
        } else if (msg.type === "tool_call") {
          cb.onToolCall(msg.name, msg.args);
          const actions = cb.getActions();
          let ok = true;
          let result: unknown;
          let error: string | undefined;
          try {
            if (!actions) throw new Error("no agent actions registered for this page");
            result = await dispatchToolCall(actions, msg.name, msg.args);
          } catch (err) {
            ok = false;
            error = err instanceof Error ? err.message : String(err);
          }
          send({ type: "tool_result", id: msg.id, ok, result, error });
        } else if (msg.type === "done") {
          cb.onDone();
        } else if (msg.type === "error") {
          cb.onError(msg.message);
        } else if (msg.type === "build_state") {
          cb.onBuildState(msg.state);
        } else if (msg.type === "build_progress") {
          // Strip the discriminator fields; the rest is per-kind payload
          // (lessonIdx, lessonId, message, error, etc.). Caller decides
          // how to merge into UI state.
          const { type: _t, kind, ...payload } = msg;
          cb.onBuildProgress(kind, payload as Record<string, unknown>);
        } else if (msg.type === "kc_built") {
          cb.onKcBuilt({
            kcId: msg.kcId,
            durationMs: msg.durationMs,
            initMs: msg.initMs,
            tokensIn: msg.tokensIn,
            tokensOut: msg.tokensOut,
            model: msg.model,
            costUsd: msg.costUsd,
          });
        } else if (msg.type === "kc_build_failed") {
          cb.onKcBuildFailed(msg.kcId, msg.error);
        } else if (msg.type === "infographic_built") {
          cb.onInfographicBuilt({
            infographicId: msg.infographicId,
            durationMs: msg.durationMs,
            initMs: msg.initMs,
            tokensIn: msg.tokensIn,
            tokensOut: msg.tokensOut,
            model: msg.model,
            costUsd: msg.costUsd,
          });
        } else if (msg.type === "infographic_build_failed") {
          cb.onInfographicBuildFailed(msg.infographicId, msg.error);
        }
      };

      ws.onerror = () => setStatus("error");

      ws.onclose = () => {
        setStatus("closed");
        if (!closed) {
          retryTimer = window.setTimeout(connect, 2000);
        }
      };
    }

    function send(msg: ClientMessage) {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [url]);

  // Generic raw send — used by orchestrator helpers below. Returns
  // false if the socket isn't open so callers can surface a friendly
  // error instead of silently dropping the message.
  const sendRaw = useCallback((msg: ClientMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      callbacksRef.current.onError("not connected to agent backend");
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const sendUserMessage = useCallback(
    (text: string) => {
      sendRaw({ type: "user_message", text });
    },
    [sendRaw],
  );

  return { status, sendUserMessage, sendRaw };
}
