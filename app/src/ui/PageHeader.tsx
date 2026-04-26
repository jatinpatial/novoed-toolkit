import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6 mb-6 border-b border-ink-200">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-semibold text-brand-700 tracking-wider uppercase mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-bold text-ink-900 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
