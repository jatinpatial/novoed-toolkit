import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shapes, BookOpen, PlayCircle, Sparkles, ArrowRight, Clock, Plus, MessageCircle } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { PageHeader } from "../ui/PageHeader";
import { listProjects, subscribeProjects, type Project } from "../store/projects";
import { HTML_COMPS, SCORM_COMPS } from "../generators/registry";

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

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    refresh();
    return subscribeProjects(refresh);
  }, []);

  const recent = projects.slice(0, 6);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Design great learning, faster."
        subtitle="Build infographics, interactive activities, and full courses. Export as HTML or SCORM. No code required."
      />

      {/* Hero tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <HeroTile
          to="/infographics"
          icon={<Shapes size={20} />}
          title="Infographic Studio"
          description="Design a single graphic — table, cards, timeline, chart, comparison."
          meta={`${HTML_COMPS.length} types`}
          accent="from-brand-500 to-brand-700"
        />
        <HeroTile
          to="/infographics?mode=scorm"
          icon={<Sparkles size={20} />}
          title="Interactive Activity"
          description="Flip cards, accordions, quizzes, polls — with animation."
          meta={`${SCORM_COMPS.length} types`}
          accent="from-amber-500 to-amber-700"
        />
        <HeroTile
          to="/courses"
          icon={<BookOpen size={20} />}
          title="Course Studio"
          description="Design full learning journeys with lessons and blocks."
          meta="Lessons + SCORM"
          accent="from-indigo-500 to-indigo-700"
        />
      </div>

      {/* Recent work */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-ink-400" />
            <h2 className="text-sm font-semibold text-ink-800">Recent work</h2>
          </div>
          {projects.length > 0 && (
            <Link to="/projects" className="text-xs font-medium text-brand-700 hover:text-brand-800 flex items-center gap-1">
              All projects <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center mx-auto mb-3">
              <Plus size={20} />
            </div>
            <h3 className="text-sm font-semibold text-ink-900 mb-1">No projects yet</h3>
            <p className="text-xs text-ink-500 mb-4">Create your first infographic or course to get started.</p>
            <div className="flex items-center justify-center gap-2">
              <Link to="/infographics" className="btn-primary btn-sm">Create infographic</Link>
              <Link to="/courses" className="btn-secondary btn-sm">Create course</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>

      {/* Copilot teaser */}
      <div className="card p-6 bg-gradient-to-br from-brand-50 via-white to-ink-50 border-brand-100">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center flex-shrink-0">
            <MessageCircle size={18} />
          </div>
          <div className="flex-1">
            <div className="chip chip-brand mb-2 text-[10px]">Coming soon</div>
            <h3 className="text-base font-semibold text-ink-900 mb-1">Claude Copilot</h3>
            <p className="text-sm text-ink-600 max-w-xl leading-relaxed">
              Describe what you want. Claude asks a few questions, generates branded content, and drops it straight into your project.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function HeroTile({ to, icon, title, description, meta, accent }: { to: string; icon: React.ReactNode; title: string; description: string; meta: string; accent: string }) {
  return (
    <Link to={to} className="card card-hover p-5 group">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink-900 mb-1">{title}</h3>
      <p className="text-sm text-ink-500 leading-relaxed mb-4">{description}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-400 font-medium">{meta}</span>
        <span className="text-brand-700 font-semibold flex items-center gap-1 group-hover:gap-1.5 transition-all">
          Open <ArrowRight size={12} />
        </span>
      </div>
    </Link>
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
