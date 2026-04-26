import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface Props {
  children: ReactNode;
  fullBleed?: boolean;
}

export function AppShell({ children, fullBleed = false }: Props) {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className={`flex-1 min-h-0 overflow-y-auto ${fullBleed ? "" : "px-8 py-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
