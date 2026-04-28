import { NavLink } from "react-router-dom";
import {
  Home, BookOpen, Shapes, Grid3x3, FolderOpen, type LucideProps,
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
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="px-3 mb-1.5 text-[10px] font-bold text-ink-400 uppercase tracking-wider">
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
        className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-ink-400 cursor-not-allowed select-none"
        title="Coming soon"
      >
        <Icon size={16} strokeWidth={2} />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-300 bg-ink-100 px-1.5 py-0.5 rounded">
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
        `flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        }`
      }
    >
      <Icon size={16} strokeWidth={2} />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}
