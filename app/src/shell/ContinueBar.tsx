import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";
import { listProjects, subscribeProjects, type Project } from "../store/projects";
import { listScripts, subscribeScripts, type Script } from "../store/scripts";
import { listKcs, subscribeKcs, type Kc } from "../store/kcs";
import {
  listInfographics,
  subscribeInfographics,
  type Infographic,
} from "../store/infographics";

/**
 * Track-P (P6): "Continue where you left off" bar.
 *
 * Rendered above the SuiteTiles on the home page when the LD has
 * any prior work. Pulls from all four stores (projects / scripts /
 * KCs / infographics), sorts by updatedAt, shows the top 4 as
 * compact chips that link back to the work surface.
 *
 * If no prior work: returns null — fresh-install LDs see only the
 * suite tiles + composer, no empty-state noise.
 *
 * Each chip:
 *   - lucide icon for the artifact type
 *   - artifact title (truncated to one line)
 *   - relative time ("3h ago")
 *   - links back to the surface where it lives (course /
 *     script / KC / infographic Studio)
 */

interface ContinueItem {
  key: string;
  title: string;
  href: string;
  icon: typeof BookOpen;
  updatedAt: number;
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function collect(): ContinueItem[] {
  const items: ContinueItem[] = [];
  // Courses (and any other Project-store kinds that route to a viewer).
  for (const p of listProjects()) {
    if (p.kind === "course") {
      items.push({
        key: `course:${p.id}`,
        title: p.name || "Untitled course",
        href: `/courses?project=${p.id}`,
        icon: BookOpen,
        updatedAt: p.updatedAt,
      });
    } else if (p.kind === "component") {
      // Legacy component-kind projects route to the legacy
      // ComponentCatalog. Keep them in the continue bar so
      // pre-pivot work isn't orphaned.
      items.push({
        key: `component:${p.id}`,
        title: p.name || "Untitled component",
        href: `/infographics?project=${p.id}`,
        icon: BarChart3,
        updatedAt: p.updatedAt,
      });
    }
    void (p as Project);
  }
  for (const s of listScripts()) {
    items.push({
      key: `script:${s.id}`,
      title: s.title || s.topic || "Untitled script",
      href: `/scripts/${s.id}`,
      icon: Video,
      updatedAt: s.updatedAt,
    });
    void (s as Script);
  }
  for (const k of listKcs()) {
    items.push({
      key: `kc:${k.id}`,
      title: k.title || k.topic || "Untitled KC",
      href: `/kcs/${k.id}`,
      icon: ClipboardCheck,
      updatedAt: k.updatedAt,
    });
    void (k as Kc);
  }
  for (const ig of listInfographics()) {
    items.push({
      key: `infographic:${ig.id}`,
      title: ig.title || ig.topic || "Untitled infographic",
      href: `/infographics/${ig.id}`,
      icon: BarChart3,
      updatedAt: ig.updatedAt,
    });
    void (ig as Infographic);
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items.slice(0, 4);
}

export function ContinueBar() {
  const [items, setItems] = useState<ContinueItem[]>(() => collect());
  useEffect(() => {
    const refresh = () => setItems(collect());
    const unsub = [
      subscribeProjects(refresh),
      subscribeScripts(refresh),
      subscribeKcs(refresh),
      subscribeInfographics(refresh),
    ];
    return () => unsub.forEach((u) => u());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="continue-bar">
      <div className="continue-bar-header">
        <span className="continue-bar-title">Continue where you left off</span>
      </div>
      <div className="continue-bar-row">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.key} to={it.href} className="continue-chip" title={it.title}>
              <Icon size={14} strokeWidth={2} className="continue-chip-icon" />
              <span className="continue-chip-title">{it.title}</span>
              <span className="continue-chip-meta">{relTime(it.updatedAt)}</span>
              <ArrowRight size={12} strokeWidth={2.5} className="continue-chip-arrow" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
