import { forwardRef, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Paperclip, Sparkles } from "lucide-react";

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
      // polish-2a bug 2: auto-send. Pre-polish-2 the dashboard composer
      // routed to /courses?brief=… and CourseStudio prefilled the chat
      // textarea — leaving the LD to click Send. Now the autosend=1
      // param tells CourseStudio to fire sendMessage directly once the
      // socket is open, so Course Architect runs without a second click.
      navigate(`/courses?brief=${encodeURIComponent(text)}&autosend=1`);
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
      <>
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
                {/* polish-2a bug 1: paperclip placeholder for the deck-
                    drop entry that lands in a future AI sprint. Disabled
                    today; the title attribute carries the "Coming soon"
                    affordance hint until the wire-up ships. */}
                <button
                  type="button"
                  disabled
                  title="Coming soon — drop a deck to design from"
                  aria-label="Attach a deck (coming soon)"
                  className="composer-paperclip"
                >
                  <Paperclip size={14} />
                </button>
                <span>Press</span>
                <kbd>↵</kbd>
                <span>to design with Studio Copilot</span>
              </div>
              {/* polish-2a bug 1: single primary CTA. The dual-button
                  layout (Design + More structured) read as competing
                  choices; LDs were defaulting to Design even when the
                  form path would have served them better. Now: one
                  primary "Design course →" button + a subtle text link
                  below the composer pointing to the structured form. */}
              <div className="composer-cta-row">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!brief.trim()}
                  className="btn-cta-primary"
                >
                  Design course <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* polish-3b: bumped from a tiny afterthought to a tinted-pill
            link with a tagline. Still secondary to the primary "Design
            course →" button — but no longer hidden. LDs see it as a
            genuine alternative path. Tagline below clarifies what the
            structured form collects (audience / duration / goals /
            source materials). */}
        <Link to="/courses/new" className="composer-secondary-link">
          Or fill in a structured brief →
        </Link>
        <div className="composer-secondary-tagline">
          Audience · duration · learning goals · source materials
        </div>
        {/* polish-3c: tertiary entry — Script Studio. For LDs who need
            just a 60-90 sec video script, not a whole course. Smaller
            than the structured-brief pill so the visual hierarchy
            stays clean: primary CTA → secondary form pill → tertiary
            text link.
            Track-B-Quiz: KC Studio joins the tertiary row alongside
            Script Studio. Same hierarchy — both are "single-component"
            entry paths into the studio suite. */}
        <div className="composer-tertiary-link">
          Just a video script?{" "}
          <Link to="/scripts/new">Try Script Studio →</Link>
        </div>
        <div className="composer-tertiary-link">
          Just a knowledge check?{" "}
          <Link to="/kcs/new">Try KC Studio →</Link>
        </div>
      </>
    );
  },
);
