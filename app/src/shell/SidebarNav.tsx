import { NavLink, Link } from "react-router-dom";
import {
  Home, BookOpen, Shapes, Grid3x3, FolderOpen, Mic, ClipboardCheck, BarChart3,
  type LucideProps,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { listProjects, subscribeProjects } from "../store/projects";
import { listScripts, subscribeScripts } from "../store/scripts";
import { listKcs, subscribeKcs } from "../store/kcs";
import { listInfographics, subscribeInfographics } from "../store/infographics";

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
    // polish-18b (Track-E): four-Studio suite consolidated into a
    // single "Studios" section. KC Studio joins Script + Infographic
    // alongside Course; Components stays as a "soon" placeholder
    // below since it's not part of the AI-generation suite.
    label: "Studios",
    items: [
      { label: "Course Studio", to: "/courses/new", icon: BookOpen },
      { label: "Script Studio", to: "/scripts/new", icon: Mic },
      { label: "KC Studio", to: "/kcs/new", icon: ClipboardCheck },
      { label: "Infographic Studio", to: "/infographics/new", icon: Shapes },
    ],
  },
  {
    label: "Catalog",
    items: [
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
      <RecentSidebarSection />
    </nav>
  );
}

interface RecentItem {
  id: string;
  title: string;
  href: string;
  icon: ComponentType<LucideProps>;
  updatedAt: number;
}

/**
 * JJ2: sidebar "Recent" block. Shows the last 5 items across all
 * four kinds (Course / Script / KC / Infographic), sorted by
 * updatedAt descending. Subscribes to all four stores so the list
 * stays live as the LD edits anything. Hides when no work exists.
 */
function RecentSidebarSection() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    function refresh() {
      const all: RecentItem[] = [
        ...listProjects()
          .filter((p) => p.kind === "course")
          .map((p) => ({
            id: p.id,
            title: p.name,
            href: `/courses?project=${p.id}`,
            icon: BookOpen,
            updatedAt: p.updatedAt,
          })),
        ...listScripts().map((s) => ({
          id: s.id,
          title: s.title || "Untitled script",
          href: `/scripts/${s.id}`,
          icon: Mic,
          updatedAt: s.updatedAt,
        })),
        ...listKcs().map((k) => ({
          id: k.id,
          title: k.title || k.topic || "Untitled KC",
          href: `/kcs/${k.id}`,
          icon: ClipboardCheck,
          updatedAt: k.updatedAt,
        })),
        ...listInfographics().map((i) => ({
          id: i.id,
          title: i.title || i.topic || "Untitled infographic",
          href: `/infographics/${i.id}`,
          icon: BarChart3,
          updatedAt: i.updatedAt,
        })),
      ];
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      setItems(all.slice(0, 5));
    }
    refresh();
    const offProjects = subscribeProjects(refresh);
    const offScripts = subscribeScripts(refresh);
    const offKcs = subscribeKcs(refresh);
    const offIg = subscribeInfographics(refresh);
    return () => {
      offProjects();
      offScripts();
      offKcs();
      offIg();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div>
      <div className="px-3 mb-2 text-eyebrow uppercase text-ink-400">Recent</div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.href}
              className="flex items-center gap-2.5 px-3 h-9 rounded-button text-[13px] text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors duration-fast ease-sana"
              title={item.title}
            >
              <Icon size={14} strokeWidth={2} className="flex-shrink-0 text-ink-400" />
              <span className="flex-1 truncate">{item.title}</span>
              <span className="text-[10px] text-ink-400 flex-shrink-0">
                {relTime(item.updatedAt)}
              </span>
            </Link>
          );
        })}
        <Link
          to="/projects"
          className="flex items-center gap-2.5 px-3 h-9 rounded-button text-[12px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
        >
          See all in Projects →
        </Link>
      </div>
    </div>
  );
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d";
  return new Date(ts).toLocaleDateString();
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
