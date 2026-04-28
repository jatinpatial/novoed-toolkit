import { HelpCircle, Download, Mail } from "lucide-react";

/**
 * Sidebar footer — secondary affordances pinned to the bottom rail.
 * Mirror the legacy index.html footer: Help, Install Claude Desktop,
 * Feedback. The Help button triggers the welcome modal; Phase 2 #1f
 * wires the trigger via the onShowWelcome callback. For now it's a
 * no-op so #1b ships without depending on later commits.
 */

interface SidebarFooterProps {
  onShowWelcome?: () => void;
}

export function SidebarFooter({ onShowWelcome }: SidebarFooterProps) {
  return (
    <div className="px-3 py-3 border-t border-ink-200 space-y-0.5">
      <button
        onClick={onShowWelcome}
        disabled={!onShowWelcome}
        className="w-full flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs font-medium text-ink-500 hover:text-ink-800 hover:bg-ink-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <HelpCircle size={14} strokeWidth={2} />
        <span>Help & how it works</span>
      </button>

      <a
        href="https://claude.ai/download"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs font-medium text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition-colors"
      >
        <Download size={14} strokeWidth={2} />
        <span>Install Claude Desktop</span>
      </a>

      <a
        href="mailto:patial.jatin@bcg.com"
        className="flex items-center gap-2.5 px-3 h-8 rounded-lg text-xs font-medium text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition-colors"
      >
        <Mail size={14} strokeWidth={2} />
        <span>Feedback &amp; requests</span>
      </a>
    </div>
  );
}
