import { forwardRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * HeroComposer — brief-entry composer on the Dashboard hero.
 *
 * Phase 2 #2 B2b rebuilt the visual shell:
 *   - Gradient border via mask trick (green-500 -> teal-500 ->
 *     yellow #FFC72C -> green-500), animated with gradient-shift
 *   - Diagonal shine sweep travels left -> right every 5s
 *   - 48px Sparkles AI orb with --orb-gradient + --shadow-orb,
 *     breathing + halo-pulse animations
 *   - Two-path CTA row in the actions strip:
 *       Detailed brief  ->  C0 intake form (disabled-with-soon
 *                            until /courses/new ships)
 *       Design          ->  current submit path (navigate to
 *                            /courses?brief=...)
 *
 * Behavior unchanged from Phase 2 #1: type a brief, press Enter (or
 * click Design), the LD lands on /courses with the brief pre-filled
 * in the Copilot chat. Course Architect picks up from there.
 *
 * Controlled — Dashboard owns the brief state so try-a-prompt pills
 * (#1d) can fill the composer with example briefs.
 *
 * "Start blank" is intentionally NOT here — the hero is committed
 * to the agent-led story. Power users who want an empty skeleton
 * can type "give me an empty course skeleton" or click through
 * the Course Studio empty state.
 *
 * Mockup anchors: docs/vision-mockup.html lines 457-578 (CSS),
 * 1457-1477 (DOM).
 */
const PLACEHOLDER =
  "e.g. 6-week change management course for senior managers in pharma";

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
      // Enter submits, Shift+Enter inserts a newline (matches the
      // chat composer convention so the muscle memory transfers).
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    }

    return (
      <div className="composer">
        <div className="composer-inner">
          <div className="composer-input">
            <div className="composer-orb" aria-hidden="true">
              <Sparkles size={20} strokeWidth={2} />
            </div>
            <textarea
              ref={textareaRef}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={onKey}
              placeholder={PLACEHOLDER}
              rows={2}
              className="composer-textarea"
            />
          </div>
          <div className="composer-actions">
            <div className="composer-helper">
              <span>Press</span>
              <kbd>↵</kbd>
              <span>to design with Studio Copilot</span>
            </div>
            <div className="composer-cta-row">
              {/*
                More structured -> /courses/new (the structured intake
                form, C0a). AI-1-polish-A bug 1: copy bumped from
                "Detailed brief" to "More structured" so the secondary
                button reads as a real choice, not an escape hatch.
                Subtitle row clarifies what makes this path different
                ("audience · duration · goals"). The form-based path
                is the BETTER entry for serious LDs working with full
                context; this button needs to invite use.
              */}
              <div className="composer-cta-secondary-stack">
                <button
                  type="button"
                  onClick={() => navigate("/courses/new")}
                  className="btn-cta-secondary"
                >
                  More structured <ArrowRight size={14} strokeWidth={2.5} />
                </button>
                <span className="composer-cta-tagline">
                  audience · duration · goals
                </span>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={!brief.trim()}
                className="btn-cta-primary"
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
