import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";

/**
 * polish-18a (Track-E): four-Studio suite tiles on the home page.
 *
 * The dashboard's primary entry point — replaces the previous
 * "Three ways to start" trio that mixed disabled placeholders with
 * the live composer. With KC Studio + Infographic Studio joining
 * the suite, all four are real, all four are equal-weight.
 *
 * Layout: 4-column grid on desktop (≥lg), 2x2 on md, single column
 * on mobile. Each card carries a lucide icon, title, 1-line
 * description, hover-lift + brand accent.
 *
 * Mounted ABOVE the HeroComposer in Dashboard.tsx — the composer
 * becomes the secondary "or describe what you have in mind" path
 * for LDs who prefer free-form briefs over the structured studio
 * forms.
 */
const TILES: {
  to: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
}[] = [
  {
    to: "/courses/new",
    icon: BookOpen,
    title: "Course Studio",
    description: "Build a full multi-week course from a brief or source material.",
  },
  {
    to: "/scripts/new",
    icon: Video,
    title: "Script Studio",
    description: "Generate a Synthesia-ready video script.",
  },
  {
    to: "/kcs/new",
    icon: ClipboardCheck,
    title: "KC Studio",
    description: "Standalone knowledge check from any source.",
  },
  {
    to: "/infographics/new",
    icon: BarChart3,
    title: "Infographic Studio",
    description: "Visual summary from source material.",
  },
];

export function SuiteTiles() {
  return (
    <section className="suite-tiles">
      {TILES.map((t) => {
        const Icon = t.icon;
        return (
          <Link key={t.to} to={t.to} className="suite-tile">
            <div className="suite-tile-icon">
              <Icon size={22} strokeWidth={2} />
            </div>
            <div className="suite-tile-title">{t.title}</div>
            <p className="suite-tile-desc">{t.description}</p>
            <span className="suite-tile-cta">
              Start <ArrowRight size={13} strokeWidth={2.5} />
            </span>
          </Link>
        );
      })}
    </section>
  );
}
