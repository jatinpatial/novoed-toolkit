import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface Props {
  children: ReactNode;
  fullBleed?: boolean;
  /**
   * Callback wired into the SidebarFooter "Help & how it works" button.
   * Pages that own a welcome modal (Dashboard) pass an opener; pages
   * that don't leave it undefined (Help renders disabled).
   */
  onShowWelcome?: () => void;
}

export function AppShell({ children, fullBleed = false, onShowWelcome }: Props) {
  return (
    <div className="h-full flex">
      <Sidebar onShowWelcome={onShowWelcome} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className={`flex-1 min-h-0 overflow-y-auto ${fullBleed ? "" : "px-8 py-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
