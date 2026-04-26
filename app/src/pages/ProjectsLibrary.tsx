import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Trash2, FolderOpen, Shapes, Sparkles, BookOpen, Plus } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { deleteProject, duplicateProject, listProjects, subscribeProjects, type Project, type ProjectKind } from "../store/projects";

const FILTERS: { id: "all" | ProjectKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "component", label: "Infographics" },
  { id: "scorm", label: "Interactives" },
  { id: "course", label: "Courses" },
];

export default function ProjectsLibrary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<"all" | ProjectKind>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    refresh();
    return subscribeProjects(refresh);
  }, []);

  const filtered = projects.filter((p) => {
    if (filter !== "all" && p.kind !== filter) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Library"
        title="My Projects"
        subtitle="Everything you've created. Reopen, duplicate, or delete any project."
        actions={
          <div className="flex gap-2">
            <Link to="/infographics" className="btn-secondary btn-sm"><Plus size={14} /> Infographic</Link>
            <Link to="/courses" className="btn-primary btn-sm"><Plus size={14} /> Course</Link>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-ink-100">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 h-8 rounded-md text-xs font-semibold transition ${filter === f.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="input max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={24} />}
            title="No projects yet"
            description="Create your first infographic or course. Everything you make here is saved automatically to your browser."
            action={
              <div className="flex gap-2">
                <Link to="/infographics" className="btn-secondary btn-sm">Create infographic</Link>
                <Link to="/courses" className="btn-primary btn-sm">Create course</Link>
              </div>
            }
          />
        ) : (
          <EmptyState
            icon={<FolderOpen size={24} />}
            title="No matches"
            description={`No projects match "${query}" in this category.`}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </AppShell>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const href = project.kind === "course" ? `/courses?project=${project.id}` : `/infographics?project=${project.id}`;
  const Icon = project.kind === "course" ? BookOpen : project.kind === "scorm" ? Sparkles : Shapes;
  const accent = project.kind === "course" ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : project.kind === "scorm" ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-brand-50 text-brand-700 border-brand-100";
  const kindLabel = project.kind === "course" ? "Course" : project.kind === "scorm" ? "Interactive" : "Infographic";
  const updated = new Date(project.updatedAt).toLocaleString();

  return (
    <div className="card card-hover group">
      <Link to={href} className="block p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${accent}`}>
            <Icon size={11} />
            {kindLabel}
          </span>
          <span className="text-[10px] text-ink-400 ml-auto uppercase tracking-wide font-semibold">{project.brand}</span>
        </div>
        <h3 className="text-sm font-semibold text-ink-900 mb-1 truncate">{project.name}</h3>
        <p className="text-xs text-ink-400">Updated {updated}</p>
      </Link>
      <div className="flex items-center border-t border-ink-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { duplicateProject(project.id); }}
          className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
        >
          <Copy size={12} /> Duplicate
        </button>
        <div className="w-px h-5 bg-ink-100" />
        <button
          onClick={() => { if (confirm(`Delete "${project.name}"?`)) deleteProject(project.id); }}
          className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

