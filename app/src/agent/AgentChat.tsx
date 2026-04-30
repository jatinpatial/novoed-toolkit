import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent } from "./AgentContext";

// Friendly labels for the loading indicator. Keys match the unprefixed
// tool names dispatched in toolExecutor.ts. Anything not in this map
// falls through to the generic "Working" label — keeps the indicator
// from leaking raw tool names into LD-facing copy.
const TOOL_LABELS: Record<string, string> = {
  list_structure: "Looking up the course",
  read_materials: "Reading your source materials",
  write_lesson: "Writing lesson content",
  write_script: "Drafting Synthesia script",
  write_knowledge_check: "Building the knowledge check",
  regenerate_question: "Regenerating that question",
  design_case_study: "Designing the case study",
  propose_course_outline: "Building the course",
  add_module: "Building the course",
  add_lesson: "Building the course",
};

function toolLabel(name: string | null): string {
  // null fallback bumped from "Working" to "Thinking" in B3-tune-a:
  // friendlier copy for the pre-tool / between-tools state. Unknown-
  // tool fallback stays "Working" so the existing e2e test (which
  // asserts "Working…" for set_brand, an unmapped tool) keeps green.
  if (!name) return "Thinking";
  return TOOL_LABELS[name] || "Working";
}

export function AgentChat() {
  const { status, messages, isThinking, currentTool, lastTarget, openLastTarget, open, setOpen, sendMessage, pendingInput, clearPendingInput } = useAgent();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (pendingInput == null) return;
    setDraft(pendingInput);
    clearPendingInput();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [pendingInput, clearPendingInput]);

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
        {isThinking && <ProgressIndicator label={toolLabel(currentTool)} />}
        {!isThinking && lastTarget && (
          <JumpButton
            label={lastTarget.kind === "script" ? "Open script editor" : "Open"}
            onClick={openLastTarget}
          />
        )}
      </div>

      <div style={inputRow}>
        <textarea
          ref={textareaRef}
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
  const isAssistant = role === "assistant";
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
          // Markdown renderer handles its own line breaks for assistant
          // bubbles. Pre-wrap stays for user/tool/error so plain-text
          // newlines render as authored.
          whiteSpace: isAssistant ? "normal" : "pre-wrap",
          fontFamily: isTool ? "ui-monospace,SFMono-Regular,Menlo,monospace" : undefined,
          opacity: pulse ? 0.6 : 1,
          wordBreak: "break-word",
        }}
      >
        {prefix}
        {isAssistant ? <MarkdownText text={text} /> : text}
      </div>
    </div>
  );
}

// Safe markdown renderer for agent replies. CommonMark-only (no tables,
// no images, no raw HTML) — keeps the chat surface tight and avoids any
// injection-style risk from agent output. Inline styles override the
// browser defaults so paragraphs/lists don't bloat the bubble.
function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      skipHtml
      disallowedElements={["img"]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 6px 0" }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: 18 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: 18 }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        h1: ({ children }) => <strong style={{ fontSize: "1em", display: "block", marginTop: 4 }}>{children}</strong>,
        h2: ({ children }) => <strong style={{ fontSize: "1em", display: "block", marginTop: 4 }}>{children}</strong>,
        h3: ({ children }) => <strong style={{ fontSize: "1em", display: "block", marginTop: 4 }}>{children}</strong>,
        code: ({ children }) => (
          <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3, fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: "0.92em" }}>
            {children}
          </code>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: "#1B7A4F", textDecoration: "underline" }}>
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote style={{ borderLeft: "3px solid #29BA74", paddingLeft: 8, margin: "4px 0", color: "#444" }}>
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function JumpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", margin: "10px 0 4px" }}>
      <button
        onClick={onClick}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(135deg,#29BA74,#1B7A4F)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(41,186,116,0.25)",
        }}
      >
        {label} →
      </button>
    </div>
  );
}

/**
 * ProgressIndicator — rebuilt in B3-tune-a to the mockup .msg-tool
 * pattern (docs/vision-mockup.html lines 1037-1054).
 *
 * Renders as an inline chat message rather than a top-of-feed bar:
 *   - White pill with 1px ink-100 border, 12px radius
 *   - 16px orb-gradient circle on the left, glowing via orb-glow
 *     keyframe at 1.4s ease-in-out (subtle pulse, calmer than the
 *     old shimmer bar)
 *   - Tool-aware label on the right ("Building the knowledge
 *     check…", "Writing lesson content…", "Thinking…", etc.)
 *
 * Visible from the moment isThinking flips true until onDone /
 * onError clears it (see AgentContext.tsx). Bug fix in the same
 * commit ensures the indicator no longer disappears on first text
 * token — so the LD gets continuous feedback across the whole turn.
 */
function ProgressIndicator({ label }: { label: string }) {
  return (
    <div className="msg-tool">
      <div className="msg-tool-orb" aria-hidden="true" />
      <span>{label}…</span>
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
