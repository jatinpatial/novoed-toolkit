import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MeshHero } from "../shell/MeshHero";
import { HeroComposer } from "../shell/HeroComposer";
import { SuiteTiles } from "../shell/SuiteTiles";
import { ContinueBar } from "../shell/ContinueBar";
import { TryAPromptPills } from "../shell/TryAPromptPills";
import { EntryCards } from "../shell/EntryCards";
import { CourseCardPhoto } from "../components/CourseCardPhoto";
import { PexelsAttribution } from "../components/PexelsAttribution";
import { useCoverImage } from "../lib/useCoverImage";
import {
  WelcomeModal, markWelcomeSeen, clearWelcomeSeen,
} from "../shell/WelcomeModal";

// Track-U: sessionStorage flag so the splash plays once per browser
// session (not on every nav back to /). Cleared automatically when
// the tab closes.
const SPLASH_SESSION_KEY = "studio.splash.played";
function shouldPlaySplash(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}
function markSplashPlayed(): void {
  try {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}
import { listProjects, saveProject, subscribeProjects, type Project } from "../store/projects";

const KIND_LABEL: Record<Project["kind"], string> = {
  component: "Infographic",
  scorm: "Interactive",
  course: "Course",
};

/**
 * Track-R4b: Pexels covers replace the legacy two-Unsplash-presets
 * array. Each Recent-work card auto-fetches a topic-relevant stock
 * photo by project name on first render; the result persists onto
 * the Project record so subsequent mounts read the cached value.
 *
 * Cards without a fetched cover (no key configured, network failure,
 * empty title) fall through to <CourseCardPhoto>'s built-in green-700
 * -> ink-900 fallback gradient.
 */

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
 * Walk a Project's nested course shape to count modules + lessons.
 *
 * Only course-kind projects have a `course` field; component / scorm
 * projects return zeros. The optional chaining on `m.lessons?.length`
 * is defensive — Course.Module.lessons is typed as required, but the
 * data is loaded from localStorage and could be partially-shaped on
 * old saves.
 *
 * Returns zeros for projects without a course shape (new project, no
 * Course Architect run yet) so the meta row renderer can skip the
 * module/lesson segments rather than show "0 modules · 0 lessons".
 */
function counts(project: Project): { modules: number; lessons: number } {
  if (project.data.kind !== "course") {
    return { modules: 0, lessons: 0 };
  }
  const modules = project.data.course.modules ?? [];
  const lessonCount = modules.reduce(
    (sum, m) => sum + (m.lessons?.length ?? 0),
    0,
  );
  return { modules: modules.length, lessons: lessonCount };
}

/**
 * Build the meta segments shown under the course title on a recent-
 * work card. Module/lesson counts are skipped when zero (new course
 * before Course Architect runs); relative time is always present.
 */
function metaFor(project: Project): string[] {
  const c = counts(project);
  const segments: string[] = [];
  if (c.modules > 0) segments.push(`${c.modules} module${c.modules === 1 ? "" : "s"}`);
  if (c.lessons > 0) segments.push(`${c.lessons} lesson${c.lessons === 1 ? "" : "s"}`);
  segments.push(`Updated ${relTime(project.updatedAt)}`);
  return segments;
}

/**
 * Dashboard — chat-first home (Phase 2 #1, redesigned in #2 B2).
 *
 * Hero composer is the primary entry point: type a brief, the agent
 * picks it up on /courses and runs Course Architect.
 *
 * Phase 2 #2 B2 dashboard rebuild — full sub-commit chain:
 *   B2a            hero shell (MeshHero wrap, display title with
 *                  italic gradient "design", glass-pill eyebrow)
 *   B2b            composer redesign (gradient border + AI orb +
 *                  two-path CTA: Detailed brief + Design)
 *   B2b-tune       dimmer orb glow, drop shine-sweep, darker mesh
 *   B2b-tune-2     orb edge glow + green wash mesh + parallax
 *   B2c            entry cards with 3D tilt + mouse-follow glow
 *   B2d (this)     recent-courses strip via <CourseCardPhoto> +
 *                  section header + pills realign
 *
 * Below-hero structure:
 *   [section]  EntryCards (Three ways to start. -> 3 cards)
 *   [section]  Recent work. -> CourseCardPhoto grid (3 cols on lg)
 *
 * Recent-work tiles render via <CourseCardPhoto>; the first two get
 * Unsplash photos from COVERS, the rest take the built-in fallback
 * gradient. Module/lesson counts walk project.data.course.modules
 * via the counts() / metaFor() helpers above.
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

  // Track-U: open WelcomeModal on every dashboard mount IF the
  // splash hasn't played yet this browser session. The modal's
  // internal state machine routes to the right stage (splash →
  // name / tour / close) based on the user record.
  useEffect(() => {
    if (shouldPlaySplash()) {
      setWelcomeOpen(true);
      markSplashPlayed();
    }
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
        {/* Track-V: BCG U logo sits IMMEDIATELY ABOVE the
            eyebrow pill, centered. Stack order: logo → eyebrow →
            headline → subtitle. User feedback was that the logo +
            eyebrow should read as a single brand-mark group. */}
        <img
          src={`${import.meta.env.BASE_URL}bcg-u-logo-dark.png`}
          alt="BCG U"
          className="hero-logo"
        />
        <div className="hero-eyebrow">AI Learning Design Studio</div>
        <h1 className="hero-title">
          What will you <span className="hero-title-accent">design</span> today?
        </h1>
        <p className="hero-subtitle">
          Drop a deck, brief in chat, or pick a Studio. Studio Copilot drafts
          the structure; you refine and ship.
        </p>

        {/* Track-P / P6: continue-where-you-left-off bar. Returns
            null when no prior work exists — fresh-install LDs see
            only the suite tiles + composer. */}
        <ContinueBar />

        {/* polish-18a + Track-P / P1: hero Course Studio + 3
            secondary tiles. Composer is now tertiary, below the
            tiles, separated by a soft divider. */}
        <SuiteTiles />

        <div className="hero-composer-divider">
          <span>or describe what you have in mind</span>
        </div>

        <HeroComposer ref={composerRef} brief={brief} setBrief={setBrief} />
        <TryAPromptPills onPick={setBrief} />
      </MeshHero>

      {/* Below-hero sections — 1208px max-width per mockup section
          shape. Both blocks share the .section-header pattern from
          B2c (32px h2 + 15px sub). */}
      <div className="max-w-[1208px] mx-auto px-8 md:px-16 py-12">
        <EntryCards onFocusComposer={focusComposer} />

        {projects.length > 0 && (
          <section className="mt-16">
            <div className="section-header">
              <div>
                <h2 className="section-title">Recent work.</h2>
                <p className="section-sub">Pick up where you left off.</p>
              </div>
              <Link to="/projects" className="entry-link">
                See all <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
            <div className="courses stagger-children">
              {recent.map((project) => (
                <RecentProjectCard key={project.id} project={project} />
              ))}
            </div>
            <PexelsAttribution />
          </section>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Track-R4b: per-project Recent-work tile. Pulls cover image from
 * Pexels by project name on first render; persists the result onto
 * the Project record so the cover stays stable across reloads.
 */
function RecentProjectCard({ project }: { project: Project }) {
  useCoverImage(project.name, project.coverImageUrl, (url, photographer, photographerUrl) => {
    saveProject({
      ...project,
      coverImageUrl: url,
      coverPhotographer: photographer,
      coverPhotographerUrl: photographerUrl,
    });
  });
  const href =
    project.kind === "course"
      ? `/courses?project=${project.id}`
      : `/infographics?project=${project.id}`;
  return (
    <CourseCardPhoto
      title={project.name}
      meta={metaFor(project)}
      tag={KIND_LABEL[project.kind]}
      imageUrl={project.coverImageUrl}
      to={href}
    />
  );
}
