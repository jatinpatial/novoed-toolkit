import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FolderOpen,
  HelpCircle,
  Mic,
  Search,
  Sparkles,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { listProjects, subscribeProjects } from "../store/projects";
import { listScripts, subscribeScripts } from "../store/scripts";
import { listKcs, subscribeKcs } from "../store/kcs";
import { listInfographics, subscribeInfographics } from "../store/infographics";

/**
 * Track-QQ5: Cmd+K command palette.
 *
 * Power-user fast-nav. Cmd+K (Mac) / Ctrl+K (Win) opens a centered
 * modal; type to fuzzy-search projects + Studio actions + help.
 *
 * Searchable items
 *   - All projects (course / script / KC / infographic) by name
 *   - Studio actions: create new course / script / KC / infographic
 *   - Library, help, welcome
 *
 * Persistence: most-recently-used commands surface at the top of the
 * empty palette via localStorage. After a command runs, its id is
 * pushed to the front of the recents list (bounded to 5).
 *
 * Library: cmdk handles fuzzy match + keyboard nav out of the box.
 * We supply the items as <Command.Item>; cmdk filters as you type.
 */

const RECENTS_KEY = "studio.cmdk_recents_v1";
const MAX_RECENTS = 5;

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: ComponentType<LucideProps>;
  /** Hint shown on the right side of the row — typically the kind. */
  hint?: string;
  run: () => void;
}

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const current = loadRecents().filter((x) => x !== id);
    current.unshift(id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(current.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore */
  }
}

interface CommandPaletteProps {
  onShowWelcome?: () => void;
  onShowHelp?: () => void;
}

export function CommandPalette({ onShowWelcome, onShowHelp }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<string[]>(() => loadRecents());

  // Trigger: Cmd+K on Mac, Ctrl+K elsewhere. Also intercepts the
  // browser's native search hotkey since the palette IS the search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset search when closing/opening so the palette feels fresh.
  useEffect(() => {
    if (!open) setSearch("");
    else setRecents(loadRecents());
  }, [open]);

  // Subscribe to all four stores so the palette reflects live work.
  // Re-derived via useMemo on each store update.
  const [projectsSig, setProjectsSig] = useState(0);
  useEffect(() => subscribeProjects(() => setProjectsSig((x) => x + 1)), []);
  useEffect(() => subscribeScripts(() => setProjectsSig((x) => x + 1)), []);
  useEffect(() => subscribeKcs(() => setProjectsSig((x) => x + 1)), []);
  useEffect(() => subscribeInfographics(() => setProjectsSig((x) => x + 1)), []);

  const items = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = [];

    // Studio creation actions — surface first when search is empty.
    out.push({
      id: "new-course",
      label: "Create new course",
      group: "Create",
      icon: BookOpen,
      run: () => navigate("/courses/new"),
    });
    out.push({
      id: "new-script",
      label: "Create new script",
      group: "Create",
      icon: Mic,
      run: () => navigate("/scripts/new"),
    });
    out.push({
      id: "new-kc",
      label: "Create new knowledge check",
      group: "Create",
      icon: ClipboardCheck,
      run: () => navigate("/kcs/new"),
    });
    out.push({
      id: "new-infographic-prompt",
      label: "Create infographic from a prompt",
      group: "Create",
      icon: BarChart3,
      hint: "Type a sentence",
      run: () => navigate("/infographics/prompt"),
    });
    out.push({
      id: "new-infographic",
      label: "Create infographic (detailed brief)",
      group: "Create",
      icon: BarChart3,
      run: () => navigate("/infographics/new"),
    });

    // Existing work — courses live in the projects store; the other
    // three Studios in their own stores.
    listProjects()
      .filter((p) => p.kind === "course")
      .forEach((p) => {
        out.push({
          id: `course-${p.id}`,
          label: p.name,
          group: "Courses",
          icon: BookOpen,
          hint: "Course",
          run: () => navigate(`/courses?project=${p.id}`),
        });
      });
    listScripts().forEach((s) => {
      out.push({
        id: `script-${s.id}`,
        label: s.title || "Untitled script",
        group: "Scripts",
        icon: Mic,
        hint: "Script",
        run: () => navigate(`/scripts/${s.id}`),
      });
    });
    listKcs().forEach((k) => {
      out.push({
        id: `kc-${k.id}`,
        label: k.title || k.topic || "Untitled KC",
        group: "Knowledge checks",
        icon: ClipboardCheck,
        hint: "KC",
        run: () => navigate(`/kcs/${k.id}`),
      });
    });
    listInfographics().forEach((i) => {
      out.push({
        id: `ig-${i.id}`,
        label: i.title || i.topic || "Untitled infographic",
        group: "Infographics",
        icon: BarChart3,
        hint: "Infographic",
        run: () => navigate(`/infographics/${i.id}`),
      });
    });

    // Navigation + help.
    out.push({
      id: "go-home",
      label: "Go home",
      group: "Navigate",
      icon: ArrowRight,
      run: () => navigate("/"),
    });
    out.push({
      id: "go-projects",
      label: "All projects",
      group: "Navigate",
      icon: FolderOpen,
      run: () => navigate("/projects"),
    });
    if (onShowHelp) {
      out.push({
        id: "open-help",
        label: "Open help",
        group: "Help",
        icon: HelpCircle,
        run: onShowHelp,
      });
    }
    if (onShowWelcome) {
      out.push({
        id: "open-welcome",
        label: "Replay welcome tour",
        group: "Help",
        icon: Sparkles,
        run: onShowWelcome,
      });
    }
    return out;
    // projectsSig invalidates on any store change; lint flags it as
    // unused but it IS the dep we care about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsSig, navigate, onShowHelp, onShowWelcome]);

  const recentItems = useMemo(() => {
    if (search.trim().length > 0) return [];
    const byId = new Map(items.map((i) => [i.id, i]));
    return recents
      .map((id) => byId.get(id))
      .filter((x): x is CommandItem => Boolean(x));
  }, [recents, items, search]);

  function runItem(item: CommandItem) {
    pushRecent(item.id);
    setOpen(false);
    // Run after the modal closes so the navigation fires after React
    // has unmounted the dialog (avoids any lingering focus traps).
    requestAnimationFrame(() => item.run());
  }

  // Group items into sections for the rendered list (used when
  // search is empty; cmdk's filter takes over once the user types).
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return map;
  }, [items]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="cmdk-dialog"
    >
      <div className="cmdk-shell" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={16} className="cmdk-input-icon" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type to search projects + actions…"
            className="cmdk-input"
            autoFocus
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <Command.List className="cmdk-list">
          <Command.Empty className="cmdk-empty">
            No matches. Try a project name or "create new course".
          </Command.Empty>

          {recentItems.length > 0 && (
            <Command.Group heading="Recent" className="cmdk-group">
              {recentItems.map((item) => (
                <CommandRow key={`r-${item.id}`} item={item} onRun={runItem} />
              ))}
            </Command.Group>
          )}

          {Array.from(grouped.entries()).map(([group, list]) => (
            <Command.Group key={group} heading={group} className="cmdk-group">
              {list.map((item) => (
                <CommandRow key={item.id} item={item} onRun={runItem} />
              ))}
            </Command.Group>
          ))}
        </Command.List>
        <div className="cmdk-footer">
          <span><kbd className="cmdk-kbd">↑</kbd><kbd className="cmdk-kbd">↓</kbd> navigate</span>
          <span><kbd className="cmdk-kbd">↵</kbd> select</span>
          <span><kbd className="cmdk-kbd">esc</kbd> close</span>
        </div>
      </div>
    </Command.Dialog>
  );
}

function CommandRow({
  item,
  onRun,
}: {
  item: CommandItem;
  onRun: (i: CommandItem) => void;
}) {
  const Icon = item.icon;
  return (
    <Command.Item
      key={item.id}
      value={`${item.group} ${item.label}`}
      onSelect={() => onRun(item)}
      className="cmdk-row"
    >
      <Icon size={15} className="cmdk-row-icon" />
      <span className="cmdk-row-label">{item.label}</span>
      {item.hint && <span className="cmdk-row-hint">{item.hint}</span>}
    </Command.Item>
  );
}
