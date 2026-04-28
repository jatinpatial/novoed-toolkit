import { Sparkles } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";

/**
 * Global app sidebar — persists across the Workspace / Start a course /
 * Build pieces / Saved surfaces. The course-canvas LeftSidebar
 * (Outline / Materials tabs) is a separate concern, lives inside
 * CourseStudio.tsx, and is not affected by this shell.
 *
 * Composition:
 *   - Logo block (BCG U Studio brand mark + tagline)
 *   - SidebarNav   (section blocks: Workspace / Start a course / etc.)
 *   - SidebarFooter (Help, Install Claude Desktop, Feedback)
 *
 * Phase 2 #1f wires the welcome-modal trigger via onShowWelcome from
 * the page that mounts this component. Today the prop is undefined,
 * so the Help button renders disabled.
 */
interface SidebarProps {
  onShowWelcome?: () => void;
}

export function Sidebar({ onShowWelcome }: SidebarProps = {}) {
  return (
    <aside className="w-60 flex-shrink-0 surface-1 border-r border-ink-200 flex flex-col">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-ink-200">
        <div className="w-9 h-9 rounded-card bg-brand-gradient flex items-center justify-center text-white shadow-resting">
          <Sparkles size={17} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-h3 text-ink-900 leading-tight tracking-tight">BCG U Studio</div>
          <div className="text-caption text-ink-500 leading-tight">Learning design platform</div>
        </div>
      </div>

      <SidebarNav />
      <SidebarFooter onShowWelcome={onShowWelcome} />
    </aside>
  );
}
