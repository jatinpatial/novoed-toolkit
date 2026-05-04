import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Video } from "lucide-react";
import { listProjects, saveProject, subscribeProjects, type Project } from "../store/projects";
import { listScripts, subscribeScripts, type Script } from "../store/scripts";
import { listKcs, saveKc, subscribeKcs, type Kc } from "../store/kcs";
import {
  listInfographics,
  saveInfographic,
  subscribeInfographics,
  type Infographic,
} from "../store/infographics";
import { useCoverImage } from "../lib/useCoverImage";

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
  /** Track-R4b: search query for the cover thumb (lesson title /
   *  topic). Empty string suppresses the fetch; chip falls back to
   *  the existing icon-only chrome. */
  coverQuery: string;
  coverImageUrl?: string;
  /** Persist callback — stores the resolved cover onto the underlying
   *  store record so the chip stays stable across reloads. */
  persistCover: (
    url: string,
    photographer: string,
    photographerUrl: string,
  ) => void;
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
        coverQuery: p.name,
        coverImageUrl: p.coverImageUrl,
        persistCover: (url, photographer, photographerUrl) =>
          saveProject({
            ...p,
            coverImageUrl: url,
            coverPhotographer: photographer,
            coverPhotographerUrl: photographerUrl,
          }),
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
        coverQuery: p.name,
        coverImageUrl: p.coverImageUrl,
        persistCover: (url, photographer, photographerUrl) =>
          saveProject({
            ...p,
            coverImageUrl: url,
            coverPhotographer: photographer,
            coverPhotographerUrl: photographerUrl,
          }),
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
      // Scripts don't carry covers — chip falls back to icon-only.
      coverQuery: "",
      persistCover: () => {},
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
      coverQuery: k.topic || k.title,
      coverImageUrl: k.coverImageUrl,
      persistCover: (url, photographer, photographerUrl) =>
        saveKc({
          ...k,
          coverImageUrl: url,
          coverPhotographer: photographer,
          coverPhotographerUrl: photographerUrl,
        }),
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
      coverQuery: ig.title || ig.topic,
      coverImageUrl: ig.coverImageUrl,
      persistCover: (url, photographer, photographerUrl) =>
        saveInfographic({
          ...ig,
          coverImageUrl: url,
          coverPhotographer: photographer,
          coverPhotographerUrl: photographerUrl,
        }),
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
        {items.map((it) => (
          <ContinueChip key={it.key} item={it} />
        ))}
      </div>
    </section>
  );
}

function ContinueChip({ item }: { item: ContinueItem }) {
  useCoverImage(item.coverQuery, item.coverImageUrl, item.persistCover);
  const Icon = item.icon;
  return (
    <Link to={item.href} className="continue-chip" title={item.title}>
      {item.coverImageUrl ? (
        <span
          className="continue-chip-thumb"
          style={{ backgroundImage: `url(${item.coverImageUrl})` }}
          aria-hidden="true"
        />
      ) : (
        <Icon size={14} strokeWidth={2} className="continue-chip-icon" />
      )}
      <span className="continue-chip-title">{item.title}</span>
      <span className="continue-chip-meta">{relTime(item.updatedAt)}</span>
      <ArrowRight size={12} strokeWidth={2.5} className="continue-chip-arrow" />
    </Link>
  );
}
