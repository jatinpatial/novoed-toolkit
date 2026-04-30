import type { ReactNode } from "react";
import { Upload, MessageCircle, Grid3x3, ArrowRight } from "lucide-react";
import { useTilt } from "./useTilt";

/**
 * Three-card landing under the hero (Phase 2 #1e, rebuilt in #2 B2c).
 *
 * Three entry paths the legacy index.html surfaced:
 *   A · From a deck      — drop a PPTX/PDF/DOCX (Coming soon)
 *   B · From an idea     — brief-in-chat (the hero composer above)
 *   C · From the catalog — browse Components (Coming soon)
 *
 * Phase 2 #2 B2c rebuild:
 *   - Cards now use the .entry-card structure: mouse-follow radial
 *     glow (::before reads --mx / --my from useTilt), accent stripe
 *     (::after, draws in left -> right on hover), 56px gradient icon
 *     that swaps to --hero-accent + scales 1.08 + rotates -3deg on
 *     hover, entry-link arrow that scoots right (gap 6 -> 12px).
 *   - Live cards spread the useTilt handlers for 3D rotation +
 *     --mx / --my glow tracking. Disabled cards skip useTilt —
 *     tilting a "soon" card reads as a misleading affordance.
 *   - The middle card ("Brief in chat") gets the .entry-card-accent
 *     modifier — green border + shadow-active — to flag it as the
 *     primary live path before the user even hovers.
 *   - Section header above the grid: "Three ways to start."
 *
 * Disabled cards still render fully (icon, step, title, description)
 * but swap the entry-link CTA at the bottom for a "Coming soon" pill
 * so the vertical layout stays the same as live cards (heights match
 * across the 3-up grid).
 *
 * "Coming soon" pill keeps the ink-100 / ink-400 vocabulary used by
 * composer-soon and the original EntryCards soonLabel — same look
 * across the app for unreleased CTAs.
 *
 * Mockup anchors: docs/vision-mockup.html lines 714-817 (CSS),
 * 1494-1538 (DOM).
 */

interface EntryCardsProps {
  onFocusComposer: () => void;
}

export function EntryCards({ onFocusComposer }: EntryCardsProps) {
  return (
    <section>
      <div className="section-header">
        <div>
          <h2 className="section-title">Three ways to start.</h2>
          <p className="section-sub">Pick the one that matches what you have.</p>
        </div>
      </div>
      <div className="entry-cards">
        <Card
          step="A · From a deck"
          title="Drop a deck"
          description="PPTX · PDF · DOCX → cover, modules, lessons, scripts, knowledge checks — drafted in one click."
          icon={<Upload size={24} strokeWidth={2} />}
          disabled
          soonLabel="Coming soon"
        />
        <Card
          step="B · From an idea"
          title="Brief in chat"
          description="Describe a course, scenario, or single component. Studio Copilot drafts the structure for you."
          icon={<MessageCircle size={24} strokeWidth={2} />}
          cta="Start in chat"
          onClick={onFocusComposer}
          accent
        />
        <Card
          step="C · From the catalog"
          title="Browse parts"
          description="47 components · journey canvas · media studio. Pick a piece, fill it in, paste it anywhere."
          icon={<Grid3x3 size={24} strokeWidth={2} />}
          disabled
          soonLabel="Coming soon"
        />
      </div>
    </section>
  );
}

interface CardProps {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
  cta?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
  soonLabel?: string;
}

function Card({
  step,
  title,
  description,
  icon,
  cta,
  onClick,
  disabled,
  accent,
  soonLabel,
}: CardProps) {
  const tilt = useTilt();
  const className =
    `entry-card${accent ? " entry-card-accent" : ""}${disabled ? " entry-card-disabled" : ""}`;

  const inner = (
    <>
      <div className={`entry-icon${disabled ? " entry-icon-soon" : ""}`}>
        {icon}
      </div>
      <div className="entry-step">{step}</div>
      <div className="entry-title">{title}</div>
      <p className="entry-desc">{description}</p>
      {disabled ? (
        <span className="entry-soon">{soonLabel ?? "Coming soon"}</span>
      ) : (
        <span className="entry-link">
          {cta} <ArrowRight size={14} strokeWidth={2.5} />
        </span>
      )}
    </>
  );

  // Disabled cards skip useTilt — tilting a card the user can't
  // click reads as a misleading affordance. Render as a plain <div>
  // so screen readers don't announce a button-like role on a
  // non-interactive surface.
  if (disabled) {
    return (
      <div className={className} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} {...tilt}>
      {inner}
    </button>
  );
}
