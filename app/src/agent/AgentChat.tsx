import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";
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

// polish-4b: personality phrases cycled when the agent is working and
// no tool is active (pre-tool or between-tools state). Replaces the
// static "Thinking…" with claude.ai-style copy that feels alive
// across a 30-45 sec turn. Order matters — index 0 is "Thinking" so
// the first frame matches the existing baseline; cycle drifts from
// there into the more characterful phrases.
//
// polish-5c: cadence slowed from 2.5s to 7s per phrase. 2.5s was
// blurring phrases together — each phrase needs time to land before
// the next. 7s is the read-then-shift cadence claude.ai uses.
const CYCLING_PHRASES = [
  "Thinking",
  "Considering the angle",
  "Stitching this together",
  "Reading between the lines",
  "Brewing the next bit",
  "Cooking up something good",
];

// polish-6a: per-tool phrase reels. Once a single tool call has been
// running long enough that the static toolLabel reads as "stuck"
// (~10 sec), swap to a cycling reel that signals what step of the
// tool's work is happening right now. Each entry should read as
// what the agent is mid-doing — present continuous, no period.
//
// The render adds a trailing "…" to the label, so phrases here end
// without punctuation. Phrase order should roughly follow the
// natural arc of the tool (open → middle → close) so even a fast
// scan reads as progress, not random chatter.
//
// Tools without an entry in this map keep their static toolLabel
// across the whole tool run — fine for short tools (regenerate_question,
// add_module). Add a new key here when a tool starts feeling slow.
const TOOL_STATUS_PHRASES: Record<string, string[]> = {
  write_lesson: [
    "Drafting the hook",
    "Choosing examples",
    "Adding callouts",
    "Building the accordion",
    "Writing key takeaways",
    "Wrapping the lesson",
  ],
  propose_course_outline: [
    "Mapping the learning arc",
    "Sequencing the modules",
    "Sizing each lesson",
    "Planting case-study slots",
  ],
  write_script: [
    "Sketching the open",
    "Pacing the scenes",
    "Writing the narration",
    "Layering in visuals",
    "Tightening the close",
  ],
  write_knowledge_check: [
    "Picking the concepts",
    "Drafting the stems",
    "Writing distractors",
    "Adding explanations",
  ],
  design_case_study: [
    "Setting the scenario",
    "Casting the protagonist",
    "Sequencing the decisions",
    "Wiring the choices",
  ],
  read_materials: [
    "Scanning the source",
    "Extracting the key points",
    "Connecting the threads",
  ],
};

const ALMOST_THERE_THRESHOLD_MS = 25_000;
const PHRASE_CYCLE_MS = 7_000;
// polish-6a: only swap from the static tool label to the cycling
// per-tool reel once the tool has been running this long. Short tool
// calls (< 10s) still see their familiar one-line label and never
// flicker through phrases. 10s is a sweet spot empirically — long
// enough that the static label has started to feel stale, short
// enough that the LD sees the reel for at least one phrase before
// the tool returns.
const TOOL_PHRASE_THRESHOLD_MS = 10_000;

export function AgentChat() {
  const { status, messages, isThinking, currentTool, lastTarget, openLastTarget, open, setOpen, sendMessage, pendingInput, clearPendingInput, outlineProposal } = useAgent();
  const [draft, setDraft] = useState("");
  // AI-1-polish-A bug 4: closing-state flag for the slide-right fade-out
  // animation when a major artifact (proposal card) takes the stage.
  // Without this, setOpen(false) snaps the panel away with no transition.
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  // AI-1-polish-A bug 4: auto-collapse the chat panel when a major
  // agent artifact lands. Today that's the CourseOutlineProposal —
  // the LD focuses on the artifact, re-opens chat by clicking the
  // floating Copilot button. Animate fade-out + slide-right over
  // 250ms via the .agent-panel-closing class, then setOpen(false).
  // Skip if chat is already closed (no double-fire on a re-mount).
  useEffect(() => {
    if (!outlineProposal || !open) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [outlineProposal, open, setOpen]);

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

  // polish-5c: the cycling-phrases logic moved out of the header into
  // the in-message ProgressIndicator (below). Header pill is now
  // static — "Connected" at rest, tool label or "Working" when in
  // flight. Pre-polish-5c the cycling sat in the header and felt
  // detached from the conversation; the in-message indicator is
  // closer to the active message and reads as the agent's live
  // thought.
  const statusLabel = (() => {
    if (status !== "open") return "Connecting…"; // ellipsis baked in
    if (!isThinking) return "Connected";
    if (currentTool) return toolLabel(currentTool);
    return "Working";
  })();
  const isWorking = status === "open" && isThinking;

  return (
    <div
      style={panel}
      className={closing ? "agent-panel-closing" : ""}
    >
      {/* B3-tune-b: Studio Copilot identity header. 36px squircle orb
          (var(--orb-gradient) + glow + breathing), bold name, status
          pill with idle/working dot. AI-1-polish-A bug 3: Sparkles
          icon centered inside the orb (regressed in B3-tune-b). */}
      <div className="copilot-mock-header">
        <div className="copilot-mock-orb">
          <Sparkles size={16} className="copilot-mock-orb-icon" aria-hidden="true" />
          {/* polish-5c: sparkle particles moved out of the header orb
              (which is large and decorative) into the in-message
              indicator's orb (which is the live status). Header orb
              keeps its B3-tune-b breathing + glow without sparkles. */}
        </div>
        <div className="copilot-mock-text">
          <div className="copilot-mock-name">Studio Copilot</div>
          <div className={`copilot-mock-status${isWorking ? " copilot-mock-status-working" : ""}`}>
            {/* Working states get an ellipsis appended for the in-flight feel. */}
            {statusLabel}{isWorking ? "…" : ""}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={closeBtn}
          title="Close"
          aria-label="Close Studio Copilot"
        >×</button>
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
        {isThinking && <ProgressIndicator />}
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

/**
 * Bubble — chat message renderer (B3-tune-b refresh).
 *
 * Agent + user bubbles now use CSS classes (.msg-agent / .msg-user)
 * matching the mockup: surface-tinted bg + green-100 border + chat-
 * tail border-radius for agent; ink-900 + right-tail for user. Both
 * fade-up via msg-in keyframe.
 *
 * Tool + error bubbles keep inline styling (rare paths — tool bubbles
 * are no longer appended in normal flow per the AgentContext comment;
 * error bubbles render only on socket / agent errors).
 */
function Bubble({ role, text, pulse }: { role: string; text: string; pulse?: boolean }) {
  const isUser = role === "user";
  const isTool = role === "tool";
  const isError = role === "error";
  const isAssistant = role === "assistant";

  // Wrapper layout: flex with alignment to either side.
  const align = isUser ? "flex-end" : "flex-start";
  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: align,
    margin: "6px 0",
    opacity: pulse ? 0.6 : 1,
  };

  if (isAssistant) {
    return (
      <div style={wrapperStyle}>
        <div className="msg-agent">
          <MarkdownText text={text} />
        </div>
      </div>
    );
  }
  if (isUser) {
    return (
      <div style={wrapperStyle}>
        <div className="msg-user">{text}</div>
      </div>
    );
  }

  // Tool + error: inline styles (rare paths, distinct visual language).
  const bg = isTool ? "#F5F5F5" : "#fef2f2";
  const color = isError ? "#b91c1c" : "#666";
  const border = isTool ? "1px dashed #d5d5d5" : "none";
  const prefix = isTool ? "→ " : "";

  return (
    <div style={wrapperStyle}>
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
          wordBreak: "break-word",
        }}
      >
        {prefix}{text}
      </div>
    </div>
  );
}

// Safe markdown renderer for agent replies. CommonMark-only (no tables,
// no images, no raw HTML) — keeps the chat surface tight and avoids any
// injection-style risk from agent output. Inline styles override the
// browser defaults so paragraphs/lists don't bloat the bubble.
function MarkdownText({ text }: { text: string }) {
  // AI-1-polish-A bug 2: agent prose was rendering through ReactMarkdown
  // already (B3-tune-b), but the visual margins were so tight (6px
  // between paragraphs, 4px around lists, 4px above headings) that the
  // result read as wall-of-text. Bumped paragraph + heading + list
  // spacing so the agent's structured output reads as structured.
  // Also tightened heading visual weight — h2/h3 now render slightly
  // bigger than body so they actually feel like section labels.
  return (
    <ReactMarkdown
      skipHtml
      disallowedElements={["img"]}
      components={{
        // Body paragraphs: more breathing room — 12px gap between
        // paragraphs reads as proper structure, not run-on prose.
        p: ({ children }) => (
          <p style={{ margin: "0 0 12px 0", lineHeight: 1.55 }}>{children}</p>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "8px 0 12px", paddingLeft: 20, lineHeight: 1.55 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "8px 0 12px", paddingLeft: 20, lineHeight: 1.55 }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color: "#0F172A" }}>{children}</strong>
        ),
        em: ({ children }) => <em>{children}</em>,
        // Headings: actually visible weight bumps so they stand out
        // from body. h2/h3 slightly larger; all bold; explicit
        // top/bottom margin so they don't crowd surrounding paragraphs.
        h1: ({ children }) => (
          <strong style={{ fontSize: "1.08em", display: "block", margin: "12px 0 6px" }}>
            {children}
          </strong>
        ),
        h2: ({ children }) => (
          <strong style={{ fontSize: "1.05em", display: "block", margin: "12px 0 6px" }}>
            {children}
          </strong>
        ),
        h3: ({ children }) => (
          <strong style={{ fontSize: "1em", display: "block", margin: "10px 0 4px" }}>
            {children}
          </strong>
        ),
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
          <blockquote style={{ borderLeft: "3px solid #29BA74", paddingLeft: 10, margin: "8px 0", color: "#374151", fontStyle: "italic" }}>
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
/**
 * AgentInflightIndicator — the in-message orb-shimmer indicator that
 * shows the agent's live status during a turn. polish-5c moved the
 * cycling-phrases state here (was previously in AgentChat's header
 * status pill). The header pill is now static; this component is
 * the live one.
 *
 * Two render shapes via the `centered` prop:
 *   - default     pill-shaped left-aligned message-row indicator.
 *                 Used inside the chat feed (replaces the legacy
 *                 ProgressIndicator).
 *   - centered    card-shaped centered indicator with bigger orb +
 *                 padding. Used by LessonCanvas (during write_lesson)
 *                 and ScriptStudio (empty state during write_script)
 *                 so the LD sees agent activity from the canvas
 *                 without having to glance at the chat panel.
 *
 * Pulls isThinking + currentTool + status from useAgent() so consumers
 * just render <AgentInflightIndicator /> and the component handles
 * its own visibility (returns null when not thinking).
 */
export function AgentInflightIndicator({
  centered = false,
}: {
  centered?: boolean;
}) {
  const { isThinking, currentTool, status } = useAgent();

  // Cycling state — phrase index + turn / tool start tracking. Same
  // logic that lived in AgentChat's header pre-polish-5c, just
  // relocated. polish-6a adds toolStartedAtRef + a tool-change reset
  // so the per-tool reel is timed against the tool, not the whole
  // turn (so a 30s turn that fires a 4s tool doesn't immediately
  // flip into the reel before the tool's static label has even
  // landed for the LD).
  const [phraseIndex, setPhraseIndex] = useState(0);
  const turnStartedAtRef = useRef<number | null>(null);
  const toolStartedAtRef = useRef<number | null>(null);
  const lastToolRef = useRef<string | null>(null);
  const [, forceTick] = useState(0); // re-render to recompute elapsed

  useEffect(() => {
    if (isThinking && turnStartedAtRef.current === null) {
      turnStartedAtRef.current = Date.now();
      setPhraseIndex(0);
      forceTick((t) => t + 1);
    } else if (!isThinking && turnStartedAtRef.current !== null) {
      turnStartedAtRef.current = null;
      toolStartedAtRef.current = null;
      lastToolRef.current = null;
    }
  }, [isThinking]);

  // polish-6a: reset the cycle whenever the active tool changes, so
  // each tool starts fresh at phrase 0 (read as "this new step is
  // beginning") rather than mid-reel from the previous tool. Also
  // resets when currentTool flips back to null (between tools).
  useEffect(() => {
    if (currentTool !== lastToolRef.current) {
      lastToolRef.current = currentTool;
      toolStartedAtRef.current = currentTool ? Date.now() : null;
      setPhraseIndex(0);
      forceTick((t) => t + 1);
    }
  }, [currentTool]);

  useEffect(() => {
    if (!isThinking) return;
    // The modulo is applied at render time against whichever array
    // is active (tool reel vs CYCLING_PHRASES), so this just
    // monotonically increments — it doesn't need to know which array
    // it's cycling. Keeps the logic dead simple across tool changes.
    const timer = setInterval(() => {
      setPhraseIndex((i) => i + 1);
      forceTick((t) => t + 1);
    }, PHRASE_CYCLE_MS);
    return () => clearInterval(timer);
  }, [isThinking]);

  if (!isThinking || status !== "open") return null;

  const elapsedMs =
    turnStartedAtRef.current !== null ? Date.now() - turnStartedAtRef.current : 0;
  const toolElapsedMs =
    toolStartedAtRef.current !== null ? Date.now() - toolStartedAtRef.current : 0;

  // polish-6a: label resolution.
  //   Tool active + reel mapped + tool elapsed ≥ threshold
  //     → cycle through the per-tool reel (e.g. "Drafting the hook")
  //   Tool active otherwise (short call, or no reel mapped)
  //     → static toolLabel (legacy behavior — "Writing lesson content")
  //   No tool, turn elapsed ≥ threshold
  //     → "Almost there" (long-tail signal)
  //   No tool otherwise
  //     → cycle through generic CYCLING_PHRASES
  let label: string;
  if (currentTool) {
    const reel = TOOL_STATUS_PHRASES[currentTool];
    if (reel && toolElapsedMs >= TOOL_PHRASE_THRESHOLD_MS) {
      label = reel[phraseIndex % reel.length];
    } else {
      label = toolLabel(currentTool);
    }
  } else if (elapsedMs >= ALMOST_THERE_THRESHOLD_MS) {
    label = "Almost there";
  } else {
    label = CYCLING_PHRASES[phraseIndex % CYCLING_PHRASES.length];
  }

  const wrapperClass = centered
    ? "agent-inflight-card"
    : "msg-tool";
  return (
    <div className={wrapperClass}>
      <div className="msg-tool-orb" aria-hidden="true">
        {/* polish-5c: 4 sparkle particles inside the in-message orb
            (moved from the header in polish-5c). Tiny — the orb is
            16px in pill mode, 22px in card mode. CSS keyframe
            sparkle-drift handles the fade + translate per nth-child. */}
        <span className="msg-tool-orb-sparkle" aria-hidden="true" />
        <span className="msg-tool-orb-sparkle" aria-hidden="true" />
        <span className="msg-tool-orb-sparkle" aria-hidden="true" />
        <span className="msg-tool-orb-sparkle" aria-hidden="true" />
      </div>
      <span>{label}…</span>
    </div>
  );
}

/**
 * ProgressIndicator — legacy alias kept for AgentChat's existing call
 * site. Renders the pill-shaped variant of AgentInflightIndicator.
 */
function ProgressIndicator() {
  return <AgentInflightIndicator />;
}

/* StatusDot removed in B3-tune-b — its functionality (a connection
   indicator) is now part of the .copilot-mock-status pill (idle dot
   green-500 with pulse-dot animation when working). The connecting /
   error states are surfaced through the status text + textarea
   disabled state rather than a separate dot. */

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

/* `header` inline style removed in B3-tune-b — replaced by the
   .copilot-mock-header CSS class which carries the new identity
   chrome (orb + name + status pill + border treatment). */

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
