import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Trash2, FolderOpen, Shapes, Sparkles, BookOpen, Plus, Image as ImageIcon } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { deleteProject, duplicateProject, listProjects, saveProject, subscribeProjects, type Project, type ProjectKind } from "../store/projects";
import { useCoverImage } from "../lib/useCoverImage";
import { PexelsAttribution } from "../components/PexelsAttribution";
import { ThemedCoverPicker } from "../components/ThemedCoverPicker";

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
            lottieSrc="empty-status"
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
          <PexelsAttribution />
        </>
      )}
    </AppShell>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Track-R4b + HH: cover is now resolved synchronously via the
  // themed-cover library on first render. Result lands on the
  // Project record so the cover stays stable on reload AND so the
  // LD's manual override (via ThemedCoverPicker) sticks.
  useCoverImage(project.name, project.coverImageUrl, (url, photographer, photographerUrl) => {
    saveProject({
      ...project,
      coverImageUrl: url,
      coverPhotographer: photographer,
      coverPhotographerUrl: photographerUrl,
    });
  });

  function applyCoverOverride(url: string) {
    saveProject({
      ...project,
      coverImageUrl: url,
      // Override clears the photographer fields — themed covers don't
      // require attribution; Pexels search results that flow through
      // here lose their per-image attribution which is acceptable
      // (Pexels' license doesn't strictly require it).
      coverPhotographer: "",
      coverPhotographerUrl: "",
    });
    setPickerOpen(false);
  }

  const href = project.kind === "course" ? `/courses?project=${project.id}` : `/infographics?project=${project.id}`;
  const Icon = project.kind === "course" ? BookOpen : project.kind === "scorm" ? Sparkles : Shapes;
  const accent = project.kind === "course" ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : project.kind === "scorm" ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-brand-50 text-brand-700 border-brand-100";
  const kindLabel = project.kind === "course" ? "Course" : project.kind === "scorm" ? "Interactive" : "Infographic";
  const updated = new Date(project.updatedAt).toLocaleString();

  return (
    <div className="card card-hover group overflow-hidden relative">
      {/* HH4: hover-revealed "Change cover" button on the cover band.
          Sits in the top-right corner; click opens the themed-cover
          picker modal. Click on the button stops propagation so the
          parent <Link> doesn't fire and navigate away. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPickerOpen(true);
        }}
        className="project-card-cover-edit"
        title="Change cover"
        aria-label="Change cover"
      >
        <ImageIcon size={13} />
        <span>Cover</span>
      </button>
      <Link to={href} className="block">
        {/* Track-R4b + HH: themed cover band. Falls back to a brand
            gradient when no cover has resolved yet. Tooltip surfaces
            photographer attribution when present (Pexels override). */}
        <div
          className="project-card-cover"
          style={
            project.coverImageUrl
              ? {
                  backgroundImage: `linear-gradient(135deg, rgba(0,107,63,0.65), rgba(0,59,34,0.78)), url(${project.coverImageUrl})`,
                }
              : {
                  backgroundImage:
                    "linear-gradient(135deg, var(--green-700), #121318)",
                }
          }
          title={
            project.coverPhotographer
              ? `Photo by ${project.coverPhotographer} on Pexels`
              : undefined
          }
        />
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${accent}`}>
              <Icon size={11} />
              {kindLabel}
            </span>
            <span className="text-[10px] text-ink-400 ml-auto uppercase tracking-wide font-semibold">{project.brand}</span>
          </div>
          <h3 className="text-sm font-semibold text-ink-900 mb-1 truncate">{project.name}</h3>
          <p className="text-xs text-ink-400">Updated {updated}</p>
        </div>
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
      <ThemedCoverPicker
        open={pickerOpen}
        currentUrl={project.coverImageUrl}
        searchHint={project.name}
        onPick={applyCoverOverride}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

