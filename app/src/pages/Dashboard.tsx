import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MeshHero } from "../shell/MeshHero";
import { HeroComposer } from "../shell/HeroComposer";
import { TryAPromptPills } from "../shell/TryAPromptPills";
import { EntryCards } from "../shell/EntryCards";
import {
  WelcomeModal, hasSeenWelcome, markWelcomeSeen, clearWelcomeSeen,
} from "../shell/WelcomeModal";
import { listProjects, subscribeProjects, type Project } from "../store/projects";

const KIND_LABEL: Record<Project["kind"], string> = {
  component: "Infographic",
  scorm: "Interactive",
  course: "Course",
};

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d ago";
  return new Date(ts).toLocaleDateString();
}

/**
 * Dashboard — chat-first home (Phase 2 #1, redesigned in #2 B2).
 *
 * The hero composer is the primary entry point: type a brief, the
 * agent picks it up on /courses and runs Course Architect.
 *
 * B2a (this commit) wraps the hero block in <MeshHero> for the
 * animated mesh-blob backdrop, swaps the eyebrow / title / subtitle
 * to the mockup's left-aligned hero-content layout (glass-pill
 * eyebrow with pulse dot, display-sized title with gradient italic
 * "design" accent, 19px ink-700 subtitle), and switches AppShell to
 * fullBleed so the mesh runs edge-to-edge. Below-hero content
 * (entry cards + recent work) lives in a 1208px max-width section
 * wrapper.
 *
 * The composer (HeroComposer), pills (TryAPromptPills), entry cards
 * (EntryCards), and recent-work strip stay structurally unchanged in
 * B2a — they still render but with their Phase 2 #1 visuals. Each
 * gets rebuilt in its own sub-commit:
 *   B2b — composer redesign (gradient border + shine + Sparkles orb
 *         + two-path CTA: Detailed brief + Design)
 *   B2c — entry cards with tilt + 3D mouse-follow glow
 *   B2d — recent-courses strip via <CourseCardPhoto> + pills polish
 *
 * Recent work survives below the hero — useful for returning users
 * who just want to jump back in.
 */
export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  // Brief state lives at the Dashboard level so the try-a-prompt pills
  // can fill the composer with example briefs (Q8a — fill, don't
  // auto-submit; user reviews and presses Enter).
  const [brief, setBrief] = useState("");
  // Ref to the hero composer's textarea — EntryCards' "Brief in chat"
  // card scrolls back up and focuses the composer when clicked.
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Welcome modal: open on first-load (no localStorage flag yet);
  // re-opens when the SidebarFooter Help button is clicked.
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenWelcome()) setWelcomeOpen(true);
  }, []);

  function focusComposer() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    composerRef.current?.focus();
  }

  function dismissWelcome() {
    setWelcomeOpen(false);
    markWelcomeSeen();
  }

  function reopenWelcome() {
    clearWelcomeSeen();
    setWelcomeOpen(true);
  }

  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    refresh();
    return subscribeProjects(refresh);
  }, []);

  const recent = projects.slice(0, 6);

  return (
    <AppShell fullBleed onShowWelcome={reopenWelcome}>
      <WelcomeModal open={welcomeOpen} onClose={dismissWelcome} />

      <MeshHero>
        <div className="hero-eyebrow">BCG U · AI Learning Design Studio</div>
        <h1 className="hero-title">
          What will you <span className="hero-title-accent">design</span> today?
        </h1>
        <p className="hero-subtitle">
          Start from a brief, drop a deck, or browse the catalog. Studio Copilot
          drafts the structure; you refine and ship.
        </p>

        <HeroComposer ref={composerRef} brief={brief} setBrief={setBrief} />
        <TryAPromptPills onPick={setBrief} />
      </MeshHero>

      {/* Below-hero sections — 1208px max-width per mockup section
          shape. Entry cards + recent work stay on their Phase 2 #1
          visuals here; each gets rebuilt in B2c / B2d. */}
      <div className="max-w-[1208px] mx-auto px-8 md:px-16 py-12">
        <EntryCards onFocusComposer={focusComposer} />

        {/* Recent work */}
        {projects.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-ink-400" />
                <h2 className="text-sm font-semibold text-ink-800">Recent work</h2>
              </div>
              <Link to="/projects" className="text-xs font-medium text-brand-700 hover:text-brand-800 flex items-center gap-1">
                All projects <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recent.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const href = project.kind === "course" ? `/courses?project=${project.id}` : `/infographics?project=${project.id}`;
  return (
    <Link to={href} className="card card-hover p-4 block">
      <div className="flex items-center gap-2 mb-2">
        <span className={`chip ${project.kind === "course" ? "chip-neutral" : project.kind === "scorm" ? "chip-amber" : "chip-brand"} text-[10px]`}>
          {KIND_LABEL[project.kind]}
        </span>
        <span className="text-[10px] text-ink-400">{relTime(project.updatedAt)}</span>
      </div>
      <div className="text-sm font-semibold text-ink-900 truncate">{project.name}</div>
    </Link>
  );
}
