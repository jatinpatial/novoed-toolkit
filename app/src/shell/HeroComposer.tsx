import { forwardRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Brief-entry composer on the Dashboard hero. Type a brief, press
 * Design → (or Enter), and the LD lands on /courses with the brief
 * pre-filled in the Copilot chat. Course Architect picks up from
 * there.
 *
 * Implementation: passes the brief via the `?brief=` URL param.
 * CoursesHome reads the param on mount, opens the Copilot, prefills
 * the composer, and clears the param so back-navigation doesn't
 * re-prefill.
 *
 * Controlled — Dashboard owns the brief state so try-a-prompt pills
 * (#1d) can fill the composer with example briefs.
 *
 * "Start blank" is intentionally NOT here — the hero is committed
 * to the agent-led story. Power users who want an empty skeleton
 * can type "give me an empty course skeleton" or click through
 * the Course Studio empty state.
 */
const PLACEHOLDER = "e.g. 4-week course on change management for senior managers leading restructurings";

interface HeroComposerProps {
  brief: string;
  setBrief: (text: string) => void;
}

export const HeroComposer = forwardRef<HTMLTextAreaElement, HeroComposerProps>(
  function HeroComposer({ brief, setBrief }, textareaRef) {
  const navigate = useNavigate();

  function submit() {
    const text = brief.trim();
    if (!text) return;
    navigate(`/courses?brief=${encodeURIComponent(text)}`);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits, Shift+Enter inserts a newline (matches the chat
    // composer convention so the muscle memory transfers).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white shadow-hero p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="hidden md:flex w-9 h-9 rounded-lg bg-brand-gradient text-white items-center justify-center flex-shrink-0">
          <Sparkles size={16} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={onKey}
            placeholder={PLACEHOLDER}
            rows={3}
            className="w-full bg-transparent border-none outline-none resize-none text-base text-ink-900 placeholder:text-ink-400 leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-ink-100">
            <div className="text-[11px] text-ink-400">
              Topic, audience, duration. The agent drafts the course outline; you click Build.
            </div>
            <button
              onClick={submit}
              disabled={!brief.trim()}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Design <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  },
);
