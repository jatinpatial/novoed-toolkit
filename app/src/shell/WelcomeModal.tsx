import { useEffect } from "react";
import { X, Upload, MessageCircle, Grid3x3, Sparkles } from "lucide-react";

/**
 * First-load welcome modal (Phase 2 #1f).
 *
 * Shown on the first Dashboard mount per the localStorage flag
 * `bcgu_studio_welcome_seen_v1`. Dismissal sets the flag so it
 * doesn't show again. The SidebarFooter "Help & how it works"
 * button calls reopen() — clears the flag and re-opens the modal —
 * so onboarding can be replayed (Q5d).
 *
 * Content mirrors the three EntryCards on the dashboard so the
 * onboarding lines up 1:1 with the surfaces a returning LD will see.
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

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        <div className="px-6 pt-6 pb-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center mb-3">
            <Sparkles size={18} strokeWidth={2.5} />
          </div>
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-1">
            Welcome to BCG U Studio
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-2">
            Three ways to start a course.
          </h2>
          <p className="text-sm text-ink-600 leading-relaxed">
            BCG U Studio is your AI-led course design workspace. Pick the entry path that matches what you have today.
          </p>
        </div>

        {/* Three rows */}
        <div className="px-6 pb-4 space-y-3">
          <Row
            icon={<Upload size={16} />}
            title="From a deck"
            description="Drop a PPTX, PDF, or DOCX. The agent reads it and proposes a course outline."
            soon
          />
          <Row
            icon={<MessageCircle size={16} />}
            title="From an idea"
            description="Type a brief into the home composer — topic, audience, duration. Course Architect drafts the outline; you click Build."
          />
          <Row
            icon={<Grid3x3 size={16} />}
            title="From the catalog"
            description="Browse pre-built components — cards, timelines, quizzes, polls. Pick a piece, fill it with your data."
            soon
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-ink-100 flex items-center justify-between gap-3">
          <div className="text-[11px] text-ink-400">
            You can re-open this from <strong className="text-ink-600">Help & how it works</strong> in the sidebar.
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
          >
            Let's go
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, title, description, soon }: { icon: React.ReactNode; title: string; description: string; soon?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${soon ? "bg-ink-100 text-ink-500" : "bg-brand-50 text-brand-700"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={`text-sm font-bold ${soon ? "text-ink-500" : "text-ink-900"}`}>{title}</div>
          {soon && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded">
              soon
            </span>
          )}
        </div>
        <div className={`text-xs leading-relaxed ${soon ? "text-ink-400" : "text-ink-600"}`}>
          {description}
        </div>
      </div>
    </div>
  );
}
