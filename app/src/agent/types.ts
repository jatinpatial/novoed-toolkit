export type ClientMessage =
  | { type: "user_message"; text: string }
  | { type: "tool_result"; id: string; ok: boolean; result?: unknown; error?: string }
  | { type: "cancel" };

export type ServerMessage =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "done"; usage?: Record<string, unknown> | null }
  | { type: "error"; message: string };

export interface ChatEntry {
  id: string;
  role: "user" | "assistant" | "tool" | "error";
  text: string;
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";
