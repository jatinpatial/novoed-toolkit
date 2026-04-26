import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useAgent } from "./AgentContext";

export function AgentChat() {
  const { status, messages, isThinking, open, setOpen, sendMessage } = useAgent();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={toggleClosed}
        title="Open AI companion"
      >
        ✨
      </button>
    );
  }

  return (
    <div style={panel}>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>Course Copilot</span>
          <StatusDot status={status} />
        </div>
        <button onClick={() => setOpen(false)} style={closeBtn} title="Close">×</button>
      </div>

      <div ref={scrollRef} style={feed}>
        {messages.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 11, lineHeight: 1.7, padding: "8px 4px" }}>
            Ask me to add modules, lessons, or blocks — or to summarize the course.
            <br /><br />
            Try: <em>"Add a module on pricing strategy with 3 lessons"</em>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} />
        ))}
        {isThinking && <Bubble role="assistant" text="…" pulse />}
      </div>

      <div style={inputRow}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder={status === "open" ? "Message the copilot…" : "Connecting…"}
          disabled={status !== "open"}
          style={textarea}
        />
        <button onClick={submit} disabled={status !== "open" || !draft.trim()} style={sendBtn}>
          Send
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, text, pulse }: { role: string; text: string; pulse?: boolean }) {
  const isUser = role === "user";
  const isTool = role === "tool";
  const isError = role === "error";
  const bg = isUser ? "#1a1a2e" : isTool ? "#F5F5F5" : isError ? "#fef2f2" : "#E6F7EF";
  const color = isUser ? "#fff" : isError ? "#b91c1c" : isTool ? "#666" : "#1a1a2e";
  const border = isTool ? "1px dashed #d5d5d5" : "none";
  const align = isUser ? "flex-end" : "flex-start";
  const prefix = isTool ? "→ " : "";

  return (
    <div style={{ display: "flex", justifyContent: align, margin: "6px 0" }}>
      <div
        style={{
          maxWidth: "86%",
          padding: isTool ? "4px 8px" : "8px 12px",
          borderRadius: 10,
          background: bg,
          color,
          border,
          fontSize: isTool ? 10 : 12,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          fontFamily: isTool ? "ui-monospace,SFMono-Regular,Menlo,monospace" : undefined,
          opacity: pulse ? 0.6 : 1,
        }}
      >
        {prefix}{text}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "open" ? "#22c55e" :
    status === "connecting" ? "#f59e0b" :
    "#ef4444";
  return (
    <span
      title={status}
      style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }}
    />
  );
}

const panel: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  top: 68,
  width: 340,
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
  display: "flex",
  flexDirection: "column",
  zIndex: 50,
  border: "1px solid #E8E8E8",
  overflow: "hidden",
};

const header: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #E8E8E8",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#fafafa",
};

const closeBtn: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  color: "#bbb",
  cursor: "pointer",
  lineHeight: 1,
  padding: "0 4px",
};

const feed: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "10px 12px",
};

const inputRow: CSSProperties = {
  borderTop: "1px solid #E8E8E8",
  padding: 8,
  display: "flex",
  gap: 6,
  background: "#fafafa",
};

const textarea: CSSProperties = {
  flex: 1,
  resize: "none",
  border: "1.5px solid #E8E8E8",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
  fontFamily: "inherit",
};

const sendBtn: CSSProperties = {
  padding: "0 12px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg,#29BA74,#1B7A4F)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const toggleClosed: CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  width: 48,
  height: 48,
  borderRadius: "50%",
  border: "none",
  background: "linear-gradient(135deg,#29BA74,#1B7A4F)",
  color: "#fff",
  fontSize: 22,
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(41,186,116,0.4)",
  zIndex: 50,
};
