import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-xl border border-dashed border-ink-200">
      <div className="w-14 h-14 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-ink-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
