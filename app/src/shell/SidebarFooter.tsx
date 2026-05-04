import { useEffect, useState } from "react";
import { HelpCircle, Download, Mail, Aperture } from "lucide-react";
import {
  isEditorialFilterOff,
  setEditorialFilterOff,
  subscribeEditorialFilter,
} from "../lib/editorialFilter";

/**
 * Sidebar footer — secondary affordances pinned to the bottom rail.
 * Mirror the legacy index.html footer: Help, Install Claude Desktop,
 * Feedback. The Help button triggers the welcome modal; Phase 2 #1f
 * wires the trigger via the onShowWelcome callback.
 *
 * QQ3: editorial-filter toggle row added — flips the photo treatment
 * pipeline (saturate / contrast / brand-tint overlay) on / off
 * app-wide. Default ON; LDs who want raw photos can opt out.
 */

interface SidebarFooterProps {
  onShowWelcome?: () => void;
}

export function SidebarFooter({ onShowWelcome }: SidebarFooterProps) {
  const rowClasses =
    "flex items-center gap-3 px-3 h-9 rounded-button text-caption font-medium text-ink-500 hover:text-ink-800 hover:bg-ink-100 transition-colors duration-fast ease-sana";

  // QQ3: subscribe to filter pref so the toggle reflects the live
  // value (e.g. when changed from another tab via the storage event).
  const [filterOff, setFilterOff] = useState<boolean>(() => isEditorialFilterOff());
  useEffect(() => subscribeEditorialFilter(() => setFilterOff(isEditorialFilterOff())), []);

  return (
    <div className="px-3 py-3 border-t border-ink-200 space-y-0.5">
      <button
        onClick={onShowWelcome}
        disabled={!onShowWelcome}
        className={`w-full ${rowClasses} disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
      >
        <HelpCircle size={14} strokeWidth={2} />
        <span>Help &amp; how it works</span>
      </button>

      <button
        onClick={() => setEditorialFilterOff(!filterOff)}
        className={`w-full ${rowClasses}`}
        title={filterOff
          ? "Editorial filter is OFF — photos render raw. Click to turn ON."
          : "Editorial filter is ON — photos get a brand tint + slight desaturation. Click to turn OFF."}
        aria-pressed={!filterOff}
      >
        <Aperture size={14} strokeWidth={2} />
        <span className="flex-1 text-left">Editorial filter</span>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            filterOff
              ? "text-ink-400 bg-ink-100"
              : "text-brand-700 bg-brand-50"
          }`}
        >
          {filterOff ? "Off" : "On"}
        </span>
      </button>

      <a
        href="https://claude.ai/download"
        target="_blank"
        rel="noreferrer"
        className={rowClasses}
      >
        <Download size={14} strokeWidth={2} />
        <span>Install Claude Desktop</span>
      </a>

      <a href="mailto:patial.jatin@bcg.com" className={rowClasses}>
        <Mail size={14} strokeWidth={2} />
        <span>Feedback &amp; requests</span>
      </a>
    </div>
  );
}
