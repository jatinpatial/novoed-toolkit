import { useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Sparkles, Video, X } from "lucide-react";
import { getUser, saveUser } from "../store/user";

/**
 * First-load welcome modal (Phase 2 #1f, rebuilt in Track-H).
 *
 * Track-H rewrite:
 *   1. Collects the LD's name (first-name preferred) into the local
 *      studio.user record. TopBar reads it for the avatar + greeting.
 *   2. Frames BCG U Studio as a 4-Studio suite (Course / Script /
 *      KC / Infographic) — matches the SuiteTiles on the dashboard
 *      so the onboarding-to-home transition is continuous.
 *   3. Reinforces the "no cloud, no sign-up" privacy contract under
 *      the input so LDs feel safe naming themselves.
 *
 * Trigger:
 *   - First-load: studio.user unset → modal opens automatically.
 *   - Manual: SidebarFooter "Help & how it works" → Dashboard's
 *     reopenWelcome() clears the seen flag + opens the modal.
 *
 * Submit behavior:
 *   - Saves studio.user, marks welcome seen, dismisses modal.
 *   - If LD just clicks the X without entering a name, modal still
 *     dismisses (markWelcomeSeen) but no user is saved — TopBar
 *     shows a "Sign in" link to re-open.
 */

const FLAG_KEY = "bcgu_studio_welcome_seen_v1";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* ignore — privacy mode etc. */
  }
}

export function clearWelcomeSeen(): void {
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore */
  }
}

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const STUDIO_ROWS: { icon: typeof BookOpen; title: string; description: string }[] = [
  {
    icon: BookOpen,
    title: "Course Studio",
    description: "Build a full multi-week course from a brief or source material.",
  },
  {
    icon: Video,
    title: "Script Studio",
    description: "Generate Synthesia-ready video scripts.",
  },
  {
    icon: ClipboardCheck,
    title: "KC Studio",
    description: "Standalone knowledge checks from any source.",
  },
  {
    icon: BarChart3,
    title: "Infographic Studio",
    description: "Visual summaries from source material.",
  },
];

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  // Pre-fill from existing user record so a re-open of the modal
  // (via SidebarFooter "Help & how it works") shows what's saved.
  const [name, setName] = useState(() => getUser()?.name ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Auto-focus the name input when the modal opens — primary
    // action on first visit is "tell us your name".
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length > 0) {
      saveUser(name);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-elevated max-w-xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {/* Track-P / P3: BCG U logo at the top of the welcome
              modal. Replaces the generic Sparkles tile so the LD
              sees the brand mark immediately. */}
          <img
            src={`${import.meta.env.BASE_URL}bcg-u-logo-dark.png`}
            alt="BCG U"
            className="block h-7 mb-3"
          />
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-1.5">
            Welcome to BCG U Studio
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2 leading-snug">
            An AI-powered course-building suite, built for BCG U Learning Designers.
          </h2>
        </div>

        {/* Name input */}
        <form onSubmit={handleSubmit} className="px-7 pb-2">
          <label className="block">
            <div className="text-sm font-semibold text-ink-900 mb-1.5">
              What should we call you?
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              className="w-full px-3 h-11 rounded-lg border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />
            <div className="text-[11px] text-ink-500 mt-1.5 italic">
              Stays on your computer — no cloud account, no sign-up.
            </div>
          </label>
        </form>

        {/* Suite framing */}
        <div className="px-7 py-5">
          <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider mb-3">
            Four Studios. One workflow.
          </div>
          <div className="space-y-2.5">
            {STUDIO_ROWS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink-900 mb-0.5">{s.title}</div>
                    <div className="text-xs text-ink-600 leading-relaxed">
                      {s.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-ink-600 leading-relaxed border-t border-ink-100 pt-3">
            Drop a deck, brief, or PDF on any Studio. The agent reads it and
            grounds your content in your material.
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-7 pb-7 pt-2 flex items-center justify-end gap-3">
          <button
            onClick={handleSubmit}
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 h-10 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
          >
            Get started <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
