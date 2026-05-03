import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";

/**
 * polish-18a (Track-E) + Track-P (P1): two-tier Studio suite.
 *
 * Track-P rework: Course Studio is the hero — full-width brand-
 * gradient card, larger padding, primary CTA. Script + KC +
 * Infographic are secondary tiles below in a 3-up grid (no
 * descriptions, just title + Start link). Reads as: "the flagship
 * is the full-course flow; here are three single-piece options too."
 *
 * Pre-Track-P all four were equal-weight; user feedback was that
 * Course Studio is the hero feature and should be visually
 * separated from the three single-piece tools.
 */

export function SuiteTiles() {
  return (
    <section className="suite-tiles">
      {/* Hero — Course Studio. Full-width brand-gradient card with
          shimmer overlay, paper-grain texture, Flagship ribbon, +
          icon wiggle on hover. The premium-feel pieces are
          intentionally subtle so the LD reads "this is the main
          one" without it feeling loud. */}
      <Link to="/courses/new" className="suite-hero">
        <span className="suite-hero-ribbon" aria-hidden="true">
          Flagship
        </span>
        <div className="suite-hero-grain" aria-hidden="true" />
        <div className="suite-hero-shimmer" aria-hidden="true" />
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

      <div className="suite-secondary-label">Or design a single piece</div>

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
        <Link to="/infographics/new" className="suite-tile suite-tile-compact">
          <div className="suite-tile-icon">
            <BarChart3 size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">Infographic Studio</div>
          <p className="suite-tile-desc">Visual summary from source</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </section>
  );
}
