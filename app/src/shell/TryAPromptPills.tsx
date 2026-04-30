/**
 * Try-a-prompt pills (Phase 2 #1d, restyled in #2 B2d).
 *
 * Small example-brief chips below the hero composer. Click a pill →
 * composer fills with that text (Q8a — fill, don't auto-submit). The
 * LD edits if needed and presses Enter / Design.
 *
 * B2d updates:
 *   - Left-aligned to match the rest of the hero stack (eyebrow,
 *     title, subtitle, composer all sit left-aligned within the
 *     1080px .mesh-hero-content slot)
 *   - Pill styling lifted to mockup spec: 13px / 500 weight, 8px /
 *     16px padding, ink-200 border, brand-50 / brand-500 / brand-700
 *     hover with a 2px lift
 *   - Spacing tightened to mockup rhythm: 36px from composer
 *     (mt-9), 12px under the eyebrow
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
    <div className="mt-9">
      {/* Eyebrow — left-aligned, ink-500 to match the mockup's pills-eyebrow */}
      <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-3">
        Try a prompt
      </div>
      {/* Wrap left-aligned (no justify-center). gap-2 = 8px matches mockup. */}
      <div className="flex flex-wrap gap-2">
        {PILLS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="px-4 py-2 rounded-full bg-white border border-ink-200 text-[13px] font-medium text-ink-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 hover:-translate-y-0.5 hover:shadow-resting transition-all duration-base ease-sana"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
