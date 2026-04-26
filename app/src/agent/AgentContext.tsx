import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Course } from "../course/types";
import type { BrandKey } from "../brand/tokens";
import type { BlockData } from "../course/types";
import type { ChatEntry, ConnectionStatus, CourseOutlineProposal } from "./types";
import { useAgentSocket } from "./useAgentSocket";

export interface WriterBlock {
  type: string;
  content: string;
}

export interface AgentActions {
  getCourse: () => Course | null;
  navigate: (route: string) => Promise<void> | void;
  setBrand: (brand: BrandKey) => void;
  addModule: (title: string) => { module_id: string };
  addLesson: (moduleId: string, title: string, duration?: number) => { lesson_id: string };
  addBlock: (lessonId: string, blockType: string, data?: Partial<BlockData>) => { block_id: string };
  updateBlock: (blockId: string, data: Partial<BlockData>) => void;
  deleteBlock: (blockId: string) => void;
  reorder: (kind: "module" | "lesson" | "block", id: string, newIndex: number) => void;
  exportLesson: (lessonId: string, format: "scorm" | "json") => void;
  writeLesson: (lessonId: string, blocks: WriterBlock[]) => { replaced: number; added: number };
  setOutlineProposal?: (proposal: CourseOutlineProposal) => void;
}

interface AgentContextValue {
  status: ConnectionStatus;
  messages: ChatEntry[];
  isThinking: boolean;
  open: boolean;
  setOpen: (b: boolean) => void;
  sendMessage: (text: string) => void;
  registerActions: (actions: AgentActions) => () => void;
  outlineProposal: CourseOutlineProposal | null;
  setOutlineProposal: (proposal: CourseOutlineProposal) => void;
  clearOutlineProposal: () => void;
  pendingInput: string | null;
  prefillInput: (text: string) => void;
  clearPendingInput: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const WS_URL = (import.meta.env.VITE_AGENT_WS_URL as string | undefined) ?? "ws://127.0.0.1:8766/ws";

export function AgentProvider({ children }: { children: ReactNode }) {
  const actionsRef = useRef<AgentActions | null>(null);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [open, setOpen] = useState(false);
  const [outlineProposal, setOutlineProposal] = useState<CourseOutlineProposal | null>(null);
  const clearOutlineProposal = useCallback(() => setOutlineProposal(null), []);
  const [pendingInput, setPendingInput] = useState<string | null>(null);
  const prefillInput = useCallback((text: string) => setPendingInput(text), []);
  const clearPendingInput = useCallback(() => setPendingInput(null), []);

  const appendMessage = useCallback((entry: ChatEntry) => {
    setMessages((prev) => [...prev, entry]);
  }, []);

  const updateLastAssistant = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: crypto.randomUUID(), role: "assistant", text }];
    });
  }, []);

  const { status, sendUserMessage } = useAgentSocket({
    url: WS_URL,
    getActions: () => actionsRef.current,
    onAssistantText: (text) => {
      setIsThinking(false);
      updateLastAssistant(text);
    },
    onToolCall: (name, args) => {
      appendMessage({
        id: crypto.randomUUID(),
        role: "tool",
        text: `${name}(${summarize(args)})`,
      });
    },
    onError: (message) => {
      setIsThinking(false);
      appendMessage({ id: crypto.randomUUID(), role: "error", text: message });
    },
    onDone: () => {
      setIsThinking(false);
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      appendMessage({ id: crypto.randomUUID(), role: "user", text });
      setIsThinking(true);
      sendUserMessage(text);
    },
    [appendMessage, sendUserMessage],
  );

  const registerActions = useCallback((actions: AgentActions) => {
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, []);

  const value = useMemo<AgentContextValue>(
    () => ({
      status,
      messages,
      isThinking,
      open,
      setOpen,
      sendMessage,
      registerActions,
      outlineProposal,
      setOutlineProposal,
      clearOutlineProposal,
      pendingInput,
      prefillInput,
      clearPendingInput,
    }),
    [status, messages, isThinking, open, sendMessage, registerActions, outlineProposal, clearOutlineProposal, pendingInput, prefillInput, clearPendingInput],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}

export function useRegisterAgentActions(actions: AgentActions) {
  const { registerActions } = useAgent();
  useEffect(() => registerActions(actions), [registerActions, actions]);
}

function summarize(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`)
    .join(", ");
}
