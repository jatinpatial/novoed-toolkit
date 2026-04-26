import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentActions } from "./AgentContext";
import type { ClientMessage, ConnectionStatus, ServerMessage } from "./types";
import { dispatchToolCall } from "./toolExecutor";

interface UseAgentSocketArgs {
  url: string;
  getActions: () => AgentActions | null;
  onAssistantText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export function useAgentSocket(args: UseAgentSocketArgs) {
  const { url, getActions, onAssistantText, onToolCall, onError, onDone } = args;
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

      ws.onopen = () => setStatus("open");

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

  const sendUserMessage = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      callbacksRef.current.onError("not connected to agent backend");
      return;
    }
    const msg: ClientMessage = { type: "user_message", text };
    ws.send(JSON.stringify(msg));
  }, []);

  return { status, sendUserMessage };
}
