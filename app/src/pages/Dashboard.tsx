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
import { listScripts, subscribeScripts, saveScript, type Script } from "../store/scripts";
import { listKcs, subscribeKcs, saveKc, type Kc } from "../store/kcs";
import { listInfographics, subscribeInfographics, saveInfographic, type Infographic } from "../store/infographics";
import { seedSampleCoursesIfNeeded } from "../store/sampleCourses";

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
  // JJ1: per-kind recent work for the four categorized sections on
  // the home page. Each store is independent — listProjects covers
  // courses, listScripts/Kcs/Infographics cover their respective
  // single-piece studios.
  const [scripts, setScripts] = useState<Script[]>([]);
  const [kcs, setKcs] = useState<Kc[]>([]);
  const [infographics, setInfographics] = useState<Infographic[]>([]);
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

  // Track-CC / CC3: drop 2 sample courses into the projects library
  // on first launch so new LDs see "what good looks like" before
  // building. Idempotent — guarded by a localStorage flag inside
  // seedSampleCoursesIfNeeded. Async fetch so a slow disk doesn't
  // block the dashboard render.
  useEffect(() => {
    seedSampleCoursesIfNeeded().catch(() => { /* swallow — non-critical */ });
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

  // JJ1: subscribe to the three single-piece studio stores so each
  // categorized section stays in sync as the LD edits / creates work
  // in any Studio. Cheap — list functions read from localStorage.
  useEffect(() => {
    const refresh = () => setScripts(listScripts());
    refresh();
    return subscribeScripts(refresh);
  }, []);
  useEffect(() => {
    const refresh = () => setKcs(listKcs());
    refresh();
    return subscribeKcs(refresh);
  }, []);
  useEffect(() => {
    const refresh = () => setInfographics(listInfographics());
    refresh();
    return subscribeInfographics(refresh);
  }, []);

  // JJ1: 6 most-recent per kind, only the courses live in the Project
  // store; scripts / KCs / infographics are in their own stores.
  const recentCourses = projects.filter((p) => p.kind === "course").slice(0, 6);
  const recentScripts = scripts.slice(0, 6);
  const recentKcs = kcs.slice(0, 6);
  const recentInfographics = infographics.slice(0, 6);
  const hasAnyRecent =
    recentCourses.length + recentScripts.length + recentKcs.length + recentInfographics.length > 0;

  return (
    <AppShell fullBleed onShowWelcome={reopenWelcome}>
      <WelcomeModal open={welcomeOpen} onClose={dismissWelcome} />

      <MeshHero>
        {/* Track-V + Y5: BCG U logo sits IMMEDIATELY ABOVE the
            eyebrow pill, LEFT-aligned. Stack order: logo → eyebrow
            → headline → subtitle. User feedback was that the logo
            + eyebrow should read as a single left-edge brand-mark
            group, not a centered crest. */}
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

        <div className="home-eyebrow">
          <span>Or describe what you have in mind</span>
        </div>

        <HeroComposer ref={composerRef} brief={brief} setBrief={setBrief} />
        <TryAPromptPills onPick={setBrief} />
      </MeshHero>

      {/* Below-hero sections — 1208px max-width per mockup section
          shape. Both blocks share the .section-header pattern from
          B2c (32px h2 + 15px sub). */}
      <div className="max-w-[1208px] mx-auto px-8 md:px-16 py-12">
        <EntryCards onFocusComposer={focusComposer} />

        {hasAnyRecent && (
          <>
            {recentCourses.length > 0 && (
              <RecentSection
                title="Recent courses."
                sub="Pick up where you left off."
                seeAllHref="/projects?filter=course"
              >
                {recentCourses.map((project) => (
                  <RecentProjectCard key={project.id} project={project} />
                ))}
              </RecentSection>
            )}
            {recentScripts.length > 0 && (
              <RecentSection
                title="Recent scripts."
                sub="Synthesia-ready video scripts."
                seeAllHref="/projects?filter=script"
              >
                {recentScripts.map((script) => (
                  <RecentScriptCard key={script.id} script={script} />
                ))}
              </RecentSection>
            )}
            {recentKcs.length > 0 && (
              <RecentSection
                title="Recent knowledge checks."
                sub="Standalone quiz banks."
                seeAllHref="/projects?filter=kc"
              >
                {recentKcs.map((kc) => (
                  <RecentKcCard key={kc.id} kc={kc} />
                ))}
              </RecentSection>
            )}
            {recentInfographics.length > 0 && (
              <RecentSection
                title="Recent infographics."
                sub="Visual summaries from source."
                seeAllHref="/projects?filter=infographic"
              >
                {recentInfographics.map((infographic) => (
                  <RecentInfographicCard key={infographic.id} infographic={infographic} />
                ))}
              </RecentSection>
            )}
            <PexelsAttribution />
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * JJ1: section shell shared across all four "Recent X" strips on the
 * home. Header + see-all link + a 3-column grid for the cards. Hides
 * itself when its `children` are empty (the dashboard already gates
 * each section on length, but the redundant check keeps this safe to
 * reuse from anywhere).
 */
function RecentSection({
  title,
  sub,
  seeAllHref,
  children,
}: {
  title: string;
  sub: string;
  seeAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first-of-type:mt-16">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-sub">{sub}</p>
        </div>
        <Link to={seeAllHref} className="entry-link">
          See all <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>
      <div className="courses stagger-children">{children}</div>
    </section>
  );
}

function RecentScriptCard({ script }: { script: Script }) {
  useCoverImage(script.title || script.topic, script.coverImageUrl, (url, photographer, photographerUrl) => {
    saveScript({
      ...script,
      coverImageUrl: url,
      coverPhotographer: photographer,
      coverPhotographerUrl: photographerUrl,
    });
  });
  const meta = [
    script.audience || "Synthesia script",
    `Updated ${relTime(script.updatedAt)}`,
  ];
  return (
    <CourseCardPhoto
      title={script.title || "Untitled script"}
      meta={meta}
      tag="Script"
      imageUrl={script.coverImageUrl}
      to={`/scripts/${script.id}`}
    />
  );
}

function RecentKcCard({ kc }: { kc: Kc }) {
  useCoverImage(kc.title || kc.topic, kc.coverImageUrl, (url, photographer, photographerUrl) => {
    saveKc({
      ...kc,
      coverImageUrl: url,
      coverPhotographer: photographer,
      coverPhotographerUrl: photographerUrl,
    });
  });
  const meta = [
    `${kc.questions.length} question${kc.questions.length === 1 ? "" : "s"}`,
    `Updated ${relTime(kc.updatedAt)}`,
  ];
  return (
    <CourseCardPhoto
      title={kc.title || "Untitled KC"}
      meta={meta}
      tag="KC"
      imageUrl={kc.coverImageUrl}
      to={`/kcs/${kc.id}`}
    />
  );
}

function RecentInfographicCard({ infographic }: { infographic: Infographic }) {
  useCoverImage(infographic.title || infographic.topic, infographic.coverImageUrl, (url, photographer, photographerUrl) => {
    saveInfographic({
      ...infographic,
      coverImageUrl: url,
      coverPhotographer: photographer,
      coverPhotographerUrl: photographerUrl,
    });
  });
  const meta = [
    infographic.style.replace("_", " "),
    `${infographic.pointCount} point${infographic.pointCount === 1 ? "" : "s"}`,
    `Updated ${relTime(infographic.updatedAt)}`,
  ];
  return (
    <CourseCardPhoto
      title={infographic.title || "Untitled infographic"}
      meta={meta}
      tag="Infographic"
      imageUrl={infographic.coverImageUrl}
      to={`/infographics/${infographic.id}`}
    />
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
