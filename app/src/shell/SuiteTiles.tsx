import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { LottiePlayer } from "../components/LottiePlayer";

/**
 * polish-18a (Track-E) + Track-P (P1) + Y4: two-tier Studio suite.
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
 *
 * Y4: hero card + each secondary tile carry a contextual photograph
 * behind the brand-gradient overlay (CSS reads the `--hero-photo` /
 * `--tile-photo` vars set inline). Photos are curated Unsplash URLs
 * — no runtime fetch, no API key dependency, deterministic visuals
 * across sessions.
 */
const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1600&q=80";
// GG5: Script Studio gets a podcast / mic photo (cleaner "video
// scripting" read than the previous movie-set photo). KC + Infographic
// photos held over from Y4.
const SCRIPT_TILE_PHOTO =
  "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&q=80";
const KC_TILE_PHOTO =
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80";
const INFOGRAPHIC_TILE_PHOTO =
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80";

// CSS var pass-through. React typing for custom properties needs an
// explicit cast — using `Record<string, string>` fits both the
// CSSProperties type and the inline-style object shape.
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
        {/* QQ1: glowing-loader Lottie sits behind the icon as ambient
            visual energy on the hero card. Pointer-events disabled so
            the entire tile click target stays intact. */}
        <div className="suite-hero-lottie" aria-hidden="true">
          <LottiePlayer src="glow-loading" className="suite-hero-lottie-fill" />
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
        <Link
          to="/scripts/new"
          className="suite-tile suite-tile-compact"
          style={cssVar("--tile-photo", SCRIPT_TILE_PHOTO)}
        >
          <div className="suite-tile-icon">
            <Video size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">Script Studio</div>
          <p className="suite-tile-desc">Synthesia-ready video script</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
        <Link
          to="/kcs/new"
          className="suite-tile suite-tile-compact"
          style={cssVar("--tile-photo", KC_TILE_PHOTO)}
        >
          <div className="suite-tile-icon">
            <ClipboardCheck size={20} strokeWidth={2} />
          </div>
          <div className="suite-tile-title">KC Studio</div>
          <p className="suite-tile-desc">Standalone knowledge check</p>
          <span className="suite-tile-cta">
            Start <ArrowRight size={13} strokeWidth={2.5} />
          </span>
        </Link>
        <Link
          to="/infographics/new"
          className="suite-tile suite-tile-compact"
          style={cssVar("--tile-photo", INFOGRAPHIC_TILE_PHOTO)}
        >
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
