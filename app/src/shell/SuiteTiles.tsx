import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { LottiePlayer } from "../components/LottiePlayer";

/**
 * polish-18a (Track-E) + Track-P (P1) + Y4 + OO4: two-tier Studio suite.
 *
 * Track-P rework: Course Studio is the hero — full-width brand-
 * gradient card, larger padding, primary CTA. Script + KC +
 * Infographic are secondary tiles below in a 3-up grid (no
 * descriptions, just title + Start link). Reads as: "the flagship
 * is the full-course flow; here are three single-piece options too."
 *
 * OO4: secondary tile photo backgrounds REMOVED. Y4 layered Unsplash
 * photos behind a white overlay; Y4 + GG5 iterated on the opacity
 * twice and never landed cleanly — photos either looked busy or
 * absent. Final call (per user): drop the photos entirely. Tiles are
 * now clean white cards with a brand accent + icon + title + desc +
 * Start CTA. The Course Studio HERO card keeps its photo (working as
 * intended).
 */
const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1600&q=80";

// CSS var pass-through for the hero photo. React typing for custom
// properties needs an explicit cast.
const cssVar = (name: string, value: string): CSSProperties =>
  ({ [name]: `url("${value}")` } as CSSProperties);

export function SuiteTiles() {
  return (
    <section className="suite-tiles">
      {/* Hero — Course Studio. Full-width brand-gradient card with
          shimmer overlay, paper-grain texture, Flagship ribbon, +
          icon wiggle on hover. The premium-feel pieces are
          intentionally subtle so the LD reads "this is the main
          one" without it feeling loud. Y4 layers a diverse-team
          collaboration photograph behind the gradient. */}
      <Link
        to="/courses/new"
        className="suite-hero"
        style={cssVar("--hero-photo", HERO_PHOTO_URL)}
      >
        <span className="suite-hero-ribbon" aria-hidden="true">
          Flagship
        </span>
        <div className="suite-hero-grain" aria-hidden="true" />
        <div className="suite-hero-shimmer" aria-hidden="true" />
        {/* QQ1 v4: hand-crafted neural-pulse replaces the off-brand teal
            glow-loading. Constellation of BCG-green nodes + teal connections
            breathing at 60fps — "AI ready to think" energy on the Course
            hero. The 600x600 aspect fits the 280x280 wrapper cleanly.
            Pointer-events disabled so the entire tile click target stays
            intact. */}
        <div className="suite-hero-lottie" aria-hidden="true">
          <LottiePlayer src="neural-pulse" className="suite-hero-lottie-fill" />
        </div>
        <div className="suite-hero-icon">
          <BookOpen size={28} strokeWidth={2} />
        </div>
        <div className="suite-hero-content">
          <div className="suite-hero-eyebrow">Build a full course</div>
          <h3 className="suite-hero-title">Course Studio</h3>
          <p className="suite-hero-desc">
            Modules, lessons, knowledge checks, and case studies —
            drafted in one click from a brief or your source material.
          </p>
        </div>
        <span className="suite-hero-cta">
          Start a course <ArrowRight size={15} strokeWidth={2.5} />
        </span>
      </Link>

      <div className="home-eyebrow"><span>Or design a single piece</span></div>

      <div className="suite-secondary">
        <Link to="/scripts/new" className="suite-tile suite-tile-compact">
          <div className="suite-tile-icon">
            <Video size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">Script Studio</div>
          <p className="suite-tile-desc">Synthesia-ready video script</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
        <Link to="/kcs/new" className="suite-tile suite-tile-compact">
          <div className="suite-tile-icon">
            <ClipboardCheck size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">KC Studio</div>
          <p className="suite-tile-desc">Standalone knowledge check</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
        {/* Track-SS (Deckster-style): Infographic tile points to the
            new Quick Prompt page (was /infographics/new — the detailed
            brief). Detailed brief still reachable via "Use the detailed
            brief →" link on the prompt page for LDs who want surgical
            control. The new prompt-first surface is the demo-friendly
            hero — "type a sentence, get an infographic." */}
        <Link to="/infographics/prompt" className="suite-tile suite-tile-compact">
          <div className="suite-tile-icon">
            <BarChart3 size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">Infographic Studio</div>
          <p className="suite-tile-desc">Type a sentence, get a visual</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </section>
  );
}
