import { Upload, MessageCircle, Grid3x3, ArrowRight } from "lucide-react";

/**
 * Three-card landing under the hero (Phase 2 #1e).
 *
 * Three entry paths the legacy index.html surfaced:
 *   - From a deck   — drop a PPTX/PDF/DOCX, agent designs from it
 *   - From an idea  — brief-in-chat (the hero composer above)
 *   - From parts    — browse the Components catalog
 *
 * Phase 2 #1 ships the chat path live; the deck and parts paths
 * are placeholders ("soon" badge, disabled). The deck-drop wiring
 * opens enough scope (pre-course materials home, agent-aware build,
 * parse error states) that it gets its own commit later — captured
 * in POLISH_BACKLOG under "Phase 2 — Deck-drop entry flow."
 */

interface EntryCardsProps {
  onFocusComposer: () => void;
}

export function EntryCards({ onFocusComposer }: EntryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-12">
      <Card
        eyebrow="A · From a deck"
        title="Drop a deck"
        description="PPTX · PDF · DOCX → cover, modules, lessons, scripts, knowledge checks — in one Word file."
        icon={<Upload size={18} />}
        cta="Open"
        disabled
        soonLabel="soon"
      />
      <Card
        eyebrow="B · From an idea"
        title="Brief in chat"
        description="Describe a course, scenario, or single component. Studio drafts the structure."
        icon={<MessageCircle size={18} />}
        cta="Open chat"
        onClick={onFocusComposer}
        accent
      />
      <Card
        eyebrow="C · From the catalog"
        title="Browse parts"
        description="Pre-built components — cards, timelines, quizzes, polls. Pick a piece, fill it with your data."
        icon={<Grid3x3 size={18} />}
        cta="Open library"
        disabled
        soonLabel="soon"
      />
    </div>
  );
}

interface CardProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
  soonLabel?: string;
}

function Card({ eyebrow, title, description, icon, cta, onClick, disabled, accent, soonLabel }: CardProps) {
  const baseClasses =
    "rounded-2xl border p-5 text-left flex flex-col h-full transition";
  const liveClasses = accent
    ? "border-brand-300 bg-brand-50/40 hover:bg-brand-50 hover:border-brand-500 shadow-card hover:shadow-elevated cursor-pointer"
    : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-elevated cursor-pointer";
  const disabledClasses =
    "border-ink-200 bg-ink-50 cursor-not-allowed opacity-90";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${disabled ? disabledClasses : liveClasses}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            disabled ? "bg-ink-200 text-ink-500" : "bg-brand-gradient text-white"
          }`}
        >
          {icon}
        </div>
        {soonLabel && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">
            {soonLabel}
          </span>
        )}
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${disabled ? "text-ink-400" : "text-brand-700"}`}>
        {eyebrow}
      </div>
      <div className={`text-base font-bold mb-1 ${disabled ? "text-ink-500" : "text-ink-900"}`}>
        {title}
      </div>
      <div className={`text-xs leading-relaxed flex-1 ${disabled ? "text-ink-400" : "text-ink-600"}`}>
        {description}
      </div>
      {!disabled && (
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
          {cta} <ArrowRight size={12} />
        </div>
      )}
    </button>
  );
}
