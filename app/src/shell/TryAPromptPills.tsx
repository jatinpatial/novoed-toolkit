/**
 * Try-a-prompt pills (Phase 2 #1d).
 *
 * Small example-brief chips below the hero composer. Click a pill →
 * composer fills with that text (Q8a — fill, don't auto-submit).
 * The LD edits if needed and presses Enter / Design →.
 *
 * Examples mirror the legacy index.html pills, lightly adapted to
 * BCG U pilot personas. Keep this list short — five chips at most;
 * more becomes scroll noise on smaller screens.
 */

const PILLS: string[] = [
  "30-min course on AI ethics for new joiners",
  "4-week change management for senior managers leading restructurings",
  "Course on stakeholder mapping for new consultants",
  "Compliance refresher for risk managers",
  "2-hour workshop on data literacy for L&D teams",
];

interface TryAPromptPillsProps {
  onPick: (text: string) => void;
}

export function TryAPromptPills({ onPick }: TryAPromptPillsProps) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-2 text-center">
        Try a prompt
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {PILLS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="text-[12px] text-ink-700 bg-white border border-ink-200 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 rounded-full px-3 py-1.5 transition"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
