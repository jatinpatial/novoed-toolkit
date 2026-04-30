import { useEffect, useRef, type ReactNode } from "react";
import "./MeshHero.css";

/**
 * MeshHero — animated mesh-gradient hero stage (Phase 2 #2 A5,
 * tuned in B2b / B2b-tune / B2b-tune-2).
 *
 * Presentational-only wrapper. Owns the chrome (5 mesh blobs + noise
 * grain + SVG constellation + 6 floating decorative shapes); consumer
 * slots eyebrow / title / subtitle / composer as `children` inside.
 *
 * Color tone evolution: A5 launched bright BCG green; B2b-tune
 * darkened toward saturated dark green per the legacy index.html;
 * B2b-tune-2 unified the palette to a green wash (teal blobs swapped
 * to greens) with one bright accent (blob-4) keeping the composition
 * alive. Filter unchanged across tunes — blur 75px + saturate 1.15,
 * no brightness modifier.
 *
 * Parallax (B2b-tune-2): a mousemove handler on the hero section
 * writes --px / --py CSS vars on the .mesh-stage div, translating
 * the whole blob layer up to 12px in either axis toward the cursor.
 * Subtle by design — drifts the mesh under the content, never jacks
 * the page. Reset on mouseleave so the stage settles back to center
 * instead of holding the last-known offset.
 *
 * Hardcoded today (no props beyond children). When a second hero
 * surface emerges (module summary, course preview), refactor to
 * `<MeshHero blobs={[…]}>` API. Premature abstraction is more cost
 * than benefit with one consumer.
 */
interface MeshHeroProps {
  children: ReactNode;
}

export function MeshHero({ children }: MeshHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    if (!hero || !stage) return;

    const handleMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      // Normalize cursor position to -0.5 ... +0.5 across each axis,
      // then scale to ±6px (so total travel is 12px end-to-end —
      // the soft cap signed off in B2b-tune-2; anything bigger reads
      // as "the page moved" rather than "the mesh breathed").
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty("--px", `${cx * 12}px`);
      stage.style.setProperty("--py", `${cy * 12}px`);
    };
    const handleLeave = () => {
      // Without this, the stage holds the last offset when the cursor
      // exits the hero — the parallax should center on idle, not
      // freeze where the cursor last was.
      stage.style.setProperty("--px", "0px");
      stage.style.setProperty("--py", "0px");
    };

    hero.addEventListener("mousemove", handleMove);
    hero.addEventListener("mouseleave", handleLeave);
    return () => {
      hero.removeEventListener("mousemove", handleMove);
      hero.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <section className="mesh-hero" ref={heroRef}>
      {/* Five animated mesh-gradient blobs — translated by the
          parallax handler via --px / --py on .mesh-stage. */}
      <div className="mesh-stage" aria-hidden="true" ref={stageRef}>
        <div className="mesh-blob blob-1" />
        <div className="mesh-blob blob-2" />
        <div className="mesh-blob blob-3" />
        <div className="mesh-blob blob-4" />
        <div className="mesh-blob blob-5" />
      </div>

      {/* SVG-noise grain overlay */}
      <div className="mesh-grain" aria-hidden="true" />

      {/* Constellation — 7 dashed lines + 9 pulsing dots.
          Coordinates lifted directly from the mockup (line 1417).
          nth-child rotation in MeshHero.css cycles dot fill through
          green-500 / teal-500 / yellow. */}
      <div className="mesh-lines" aria-hidden="true">
        <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
          <line x1="200" y1="100" x2="400" y2="180" />
          <line x1="400" y1="180" x2="600" y2="80" />
          <line x1="600" y1="80" x2="900" y2="200" />
          <line x1="900" y1="200" x2="1100" y2="120" />
          <line x1="200" y1="450" x2="450" y2="380" />
          <line x1="450" y1="380" x2="700" y2="500" />
          <line x1="700" y1="500" x2="1000" y2="430" />
          <circle cx="200"  cy="100" r="3" />
          <circle cx="400"  cy="180" r="3" />
          <circle cx="600"  cy="80"  r="3" />
          <circle cx="900"  cy="200" r="3" />
          <circle cx="1100" cy="120" r="3" />
          <circle cx="200"  cy="450" r="3" />
          <circle cx="450"  cy="380" r="3" />
          <circle cx="700"  cy="500" r="3" />
          <circle cx="1000" cy="430" r="3" />
        </svg>
      </div>

      {/* Six floating decorative shapes — rounded square gradient,
          yellow dot, gradient line, rotated outline square, teal
          gradient circle, dashed-border spinner. Mockup lines 324–375. */}
      <div className="deco-shapes" aria-hidden="true">
        <div className="deco-shape s1" />
        <div className="deco-shape s2" />
        <div className="deco-shape s3" />
        <div className="deco-shape s4" />
        <div className="deco-shape s5" />
        <div className="deco-shape s6" />
      </div>

      <div className="mesh-hero-content">{children}</div>
    </section>
  );
}
