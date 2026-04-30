import { NavLink } from "react-router-dom";
import {
  Home, BookOpen, Shapes, Grid3x3, FolderOpen, Mic, type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Sidebar navigation sections — mirrors the legacy index.html structure:
 *   Workspace / Start a course / Build pieces / Saved
 *
 * Items inside each section map to existing app routes; placeholder
 * items (Components catalog) render disabled per the Phase 2 #1
 * out-of-scope list. SCORM Player is intentionally NOT in the sidebar
 * (per Q9c) — still navigable via direct URL for developer use.
 */

interface NavItem {
  label: string;
  to?: string; // omit for disabled placeholders
  icon: ComponentType<LucideProps>;
  badge?: string; // small text after the label, e.g. "47" or "soon"
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Home", to: "/", icon: Home },
    ],
  },
  {
    label: "Start a course",
    items: [
      { label: "Course Studio", to: "/courses", icon: BookOpen },
    ],
  },
  {
    label: "Build pieces",
    items: [
      // polish-4a: Script Studio entry. Routes to /scripts/new for
      // the intake form; an existing script is opened by clicking
      // its row in /projects (Phase-3-ish — scripts list view TBD).
      { label: "Script Studio", to: "/scripts/new", icon: Mic },
      { label: "Infographic Studio", to: "/infographics", icon: Shapes },
      // Phase-3 placeholder — Components catalog port. Disabled until
      // the index.html catalog ships into the React app.
      { label: "Components", icon: Grid3x3, badge: "soon" },
    ],
  },
  {
    label: "Saved",
    items: [
      { label: "My Projects", to: "/projects", icon: FolderOpen },
    ],
  },
];

export function SidebarNav() {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="px-3 mb-2 text-eyebrow uppercase text-ink-400">
            {section.label}
          </div>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow key={item.label} item={item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavRow({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (!item.to) {
    return (
      <div
        className="flex items-center gap-3 px-3 h-10 rounded-button text-body font-medium text-ink-400 cursor-not-allowed select-none"
        title="Coming soon"
      >
        <Icon size={16} strokeWidth={2} />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="text-eyebrow uppercase text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">
            {item.badge}
          </span>
        )}
      </div>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        // Active state uses a 2px left accent bar (brand-500) plus the
        // brand-50 fill — keeps the green deliberate (per the
        // shadow-active discipline rule). Hover is neutral.
        // ease-sana via duration-fast on bg + colour transitions.
        `relative flex items-center gap-3 px-3 h-10 rounded-button text-body font-medium transition-colors duration-fast ease-sana ${
          isActive
            ? "bg-brand-50 text-brand-700 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-500 before:rounded-full"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        }`
      }
    >
      <Icon size={16} strokeWidth={2} />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-eyebrow uppercase text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}
