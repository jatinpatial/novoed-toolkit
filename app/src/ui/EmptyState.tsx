import type { ReactNode } from "react";
import { LottiePlayer } from "../components/LottiePlayer";

interface Props {
  icon?: ReactNode;
  /** QQ1: optional Lottie animation as the empty-state hero. When set,
   *  renders larger and replaces the icon disc. Falls back to icon
   *  silently if the JSON is missing. */
  lottieSrc?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, lottieSrc, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-xl border border-dashed border-ink-200">
      {lottieSrc ? (
        <div className="w-32 h-32 mb-4 pointer-events-none">
          <LottiePlayer src={lottieSrc} className="w-full h-full" />
        </div>
      ) : (
        icon && (
          <div className="w-14 h-14 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center mb-4">
            {icon}
          </div>
        )
      )}
      <h3 className="text-base font-semibold text-ink-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
