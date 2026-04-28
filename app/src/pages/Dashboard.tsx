import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { HeroComposer } from "../shell/HeroComposer";
import { TryAPromptPills } from "../shell/TryAPromptPills";
import { EntryCards } from "../shell/EntryCards";
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
 * Dashboard — chat-first home (Phase 2 #1).
 *
 * The hero composer is the primary entry point: type a brief, the
 * agent picks it up on /courses and runs Course Architect. Three-card
 * landing (#1e), try-a-prompt pills (#1d), and welcome modal (#1f)
 * compose around the hero in subsequent commits.
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

  function focusComposer() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    composerRef.current?.focus();
  }

  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    refresh();
    return subscribeProjects(refresh);
  }, []);

  const recent = projects.slice(0, 6);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pt-6 pb-12">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-3">
            BCG U · AI Learning Design Studio
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink-900 mb-3">
            What will you <span className="text-brand-700">design</span> today?
          </h1>
          <p className="text-sm text-ink-500 max-w-2xl mx-auto">
            Three ways to start. Pick the one that matches what you have.
          </p>
        </div>

        <HeroComposer ref={composerRef} brief={brief} setBrief={setBrief} />
        <TryAPromptPills onPick={setBrief} />

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
