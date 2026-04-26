import { NavLink } from "react-router-dom";
import { LayoutGrid, Shapes, BookOpen, PlayCircle, FolderOpen, Sparkles, Mail } from "lucide-react";

const nav = [
  { to: "/",            label: "Dashboard",       icon: LayoutGrid },
  { to: "/infographics", label: "Infographic Studio", icon: Shapes },
  { to: "/courses",     label: "Course Studio",   icon: BookOpen },
  { to: "/player",      label: "SCORM Player",    icon: PlayCircle },
  { to: "/projects",    label: "My Projects",     icon: FolderOpen },
];

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-ink-200 flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-ink-200">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
          <Sparkles size={16} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink-900 leading-tight">BCG U Studio</div>
          <div className="text-[10px] text-ink-500 leading-tight">Learning design platform</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-ink-200">
        <a
          href="mailto:jatin.patial@bcg.com"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition-colors"
        >
          <Mail size={14} />
          <span>Feedback & requests</span>
        </a>
      </div>
    </aside>
  );
}
