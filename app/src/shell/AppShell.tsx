import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { HelpDrawer } from "./HelpDrawer";

interface Props {
  children: ReactNode;
  fullBleed?: boolean;
  /**
   * Callback wired into the SidebarFooter "Help & how it works" button
   * AND the TopBar's avatar-menu "Reset profile" path. Pages that own
   * a welcome modal (Dashboard) pass an opener; pages that don't leave
   * it undefined.
   */
  onShowWelcome?: () => void;
}

export function AppShell({ children, fullBleed = false, onShowWelcome }: Props) {
  // Track-H / H3: HelpDrawer state lives at the AppShell level so
  // every page can open it without re-mounting the drawer per route.
  // TopBar's HelpCircle button + Cmd/Ctrl+? shortcut + avatar menu's
  // "Help guide" all call setHelpOpen(true).
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="h-full flex">
      <Sidebar onShowWelcome={onShowWelcome} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          onShowHelp={() => setHelpOpen(true)}
          onShowWelcome={onShowWelcome}
        />
        <main className={`flex-1 min-h-0 overflow-y-auto ${fullBleed ? "" : "px-8 py-6"}`}>
          {children}
        </main>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
