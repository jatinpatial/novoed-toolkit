import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, BookOpen, ClipboardCheck,
  FileUp, Sparkles, Video, X,
} from "lucide-react";
import { getUser, markTourCompleted, saveUser } from "../store/user";

/**
 * First-load welcome modal (Track-Q full redesign).
 *
 * Three-stage flow inspired by Netflix-style onboarding:
 *
 *   Stage SPLASH    Brand splash. BCG U logo + "BCG U Studio"
 *                   wordmark fade + scale in over 1.6s. Particle
 *                   orbs animate in the background. Auto-advances
 *                   to NAME after 1800ms.
 *
 *   Stage NAME      Welcome screen. Background lightens; "Welcome"
 *                   types out character-by-character; subtitle
 *                   fades in. Name input slides up from bottom.
 *                   Submit auto-advances to TOUR (or directly to
 *                   close if tour was completed in a prior visit).
 *
 *   Stage TOUR      Skippable 4-step tour:
 *                     1. Choose your Studio
 *                     2. Drop source material
 *                     3. One click, full content
 *                     4. Refine, export, ship
 *                   Each step has a heading, body, and visual.
 *                   Skip / Next / Start designing CTAs.
 *
 * Triggers
 *   - First-load: studio.user unset → opens at SPLASH.
 *   - Returning user (studio.user set, tourCompleted unset): opens
 *     at TOUR (their choice to finish what they didn't last time).
 *   - Manual reopen via SidebarFooter / Avatar menu: opens at NAME
 *     so the LD can edit their name; tour stage skipped if already
 *     completed.
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

type Stage = "splash" | "name" | "tour";

const TOUR_STEPS: {
  icon: typeof BookOpen;
  heading: string;
  body: string;
  caption: string;
}[] = [
  {
    icon: Sparkles,
    heading: "Choose your Studio",
    body: "Course, Script, KC, or Infographic. Each Studio is purpose-built for one kind of output.",
    caption: "Start with the right tool for what you want to build.",
  },
  {
    icon: FileUp,
    heading: "Drop your source material",
    body: "PDFs, decks, Word docs. The agent reads what you upload and grounds your content in your material — not generic L&D.",
    caption: "Your frameworks, your language. Drafted into the format you picked.",
  },
  {
    icon: BookOpen,
    heading: "One click, full content",
    body: "Walk away. Come back to a fully drafted course with lessons, knowledge checks, and case studies. ~$2 per course.",
    caption: "Watch the progress band fill while you grab coffee.",
  },
  {
    icon: ArrowRight,
    heading: "Refine, export, ship",
    body: "Edit any block. Export to Word or PNG. Paste into NovoEd. Done.",
    caption: "All your work stays on this computer. No cloud, no sign-up.",
  },
];

const STUDIO_PILLS: {
  icon: typeof BookOpen;
  label: string;
}[] = [
  { icon: BookOpen, label: "Course" },
  { icon: Video, label: "Script" },
  { icon: ClipboardCheck, label: "KC" },
  { icon: BarChart3, label: "Infographic" },
];

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  // Initial stage: splash for first-load (no user yet) or name for
  // returning users without a saved tour. Manual reopen lands on
  // NAME so the LD can edit their info.
  const [stage, setStage] = useState<Stage>(() => {
    const u = getUser();
    if (!u) return "splash";
    if (!u.tourCompleted) return "tour";
    return "name";
  });
  const [name, setName] = useState(() => getUser()?.name ?? "");
  const [tourStep, setTourStep] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Splash auto-advance — 1800ms gives the fade + scale animation
  // time to complete plus a beat to read the wordmark.
  useEffect(() => {
    if (!open) return;
    if (stage !== "splash") return;
    const t = setTimeout(() => setStage("name"), 1800);
    return () => clearTimeout(t);
  }, [open, stage]);

  // Auto-focus the input when the NAME stage is active.
  useEffect(() => {
    if (!open) return;
    if (stage !== "name") return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, stage]);

  // Esc dismisses everywhere (saves whatever's filled in so far).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (name.trim().length > 0 && !getUser()) saveUser(name);
        markTourCompleted();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, name, onClose]);

  if (!open) return null;

  function handleNameSubmit() {
    if (name.trim().length > 0) {
      saveUser(name);
    }
    // If the user already completed the tour in a prior session,
    // skip directly to close. Otherwise advance to the tour.
    const u = getUser();
    if (u?.tourCompleted) {
      onClose();
    } else {
      setStage("tour");
    }
  }

  function finishTour() {
    markTourCompleted();
    onClose();
  }

  return (
    <div
      className={`welcome-modal welcome-stage-${stage}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Always-on background gradient with floating orbs. The
          gradient + orb intensity transitions per stage via CSS
          on .welcome-modal[stage]. */}
      <div className="welcome-bg" aria-hidden="true">
        <div className="welcome-orb welcome-orb-1" />
        <div className="welcome-orb welcome-orb-2" />
        <div className="welcome-orb welcome-orb-3" />
      </div>

      {/* Top-right close. Hidden during splash. */}
      {stage !== "splash" && (
        <button
          onClick={() => {
            if (name.trim().length > 0 && !getUser()) saveUser(name);
            markTourCompleted();
            onClose();
          }}
          className="welcome-close"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}

      {stage === "splash" && <SplashStage />}
      {stage === "name" && (
        <NameStage
          inputRef={inputRef}
          name={name}
          setName={setName}
          onSubmit={handleNameSubmit}
        />
      )}
      {stage === "tour" && (
        <TourStage
          step={tourStep}
          onNext={() => {
            if (tourStep < TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
            else finishTour();
          }}
          onBack={() => setTourStep(Math.max(0, tourStep - 1))}
          onSkip={finishTour}
          onFinish={finishTour}
          name={getUser()?.name ?? name}
        />
      )}
    </div>
  );
}

function SplashStage() {
  return (
    <div className="welcome-splash">
      <img
        src={`${import.meta.env.BASE_URL}bcg-u-logo-light.png`}
        alt="BCG U"
        className="welcome-splash-logo"
      />
      <div className="welcome-splash-wordmark">
        <span className="welcome-splash-wordmark-bcgu">BCG U</span>{" "}
        <span className="welcome-splash-wordmark-studio">Studio</span>
      </div>
      <div className="welcome-splash-tagline">
        AI-powered course design
      </div>
    </div>
  );
}

function NameStage({
  inputRef,
  name,
  setName,
  onSubmit,
}: {
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  name: string;
  setName: (n: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="welcome-card welcome-card-name">
      <img
        src={`${import.meta.env.BASE_URL}bcg-u-logo-dark.png`}
        alt="BCG U"
        className="welcome-card-logo"
      />
      <h2 className="welcome-typed-heading">Welcome</h2>
      <p className="welcome-typed-sub">Let's get you set up.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="welcome-name-form"
      >
        <label className="block w-full">
          <span className="block text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
            What should we call you?
          </span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="welcome-name-input"
          />
          <span className="welcome-privacy-note">
            Stays on your computer. No cloud account, no sign-up.
          </span>
        </label>
        <button type="submit" className="welcome-name-cta">
          Continue <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}

function TourStage({
  step,
  onNext,
  onBack,
  onSkip,
  onFinish,
  name,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  name: string;
}) {
  const navigate = useNavigate();
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const greeting = name ? `Hi ${name.split(/\s+/)[0]} —` : "Hi —";

  return (
    <div className="welcome-card welcome-card-tour">
      <div className="welcome-tour-greeting">{greeting} here's how this works.</div>

      <div className="welcome-tour-step">
        <div className="welcome-tour-icon">
          <Icon size={28} strokeWidth={2} />
        </div>
        <div className="welcome-tour-step-label">
          Step {step + 1} of {TOUR_STEPS.length}
        </div>
        <h3 className="welcome-tour-heading">{current.heading}</h3>
        <p className="welcome-tour-body">{current.body}</p>
        <div className="welcome-tour-caption">{current.caption}</div>

        {/* Visual — Studio pill row on step 1, otherwise generic
            decorative band. Keeps the visual energy without
            requiring per-step illustrations. */}
        {step === 0 && (
          <div className="welcome-tour-pills">
            {STUDIO_PILLS.map((s) => {
              const PIcon = s.icon;
              return (
                <div key={s.label} className="welcome-tour-pill">
                  <PIcon size={16} strokeWidth={2} />
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="welcome-tour-controls">
        <button onClick={onSkip} className="welcome-tour-skip">
          Skip
        </button>
        <div className="welcome-tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`welcome-tour-dot${i === step ? " welcome-tour-dot-active" : ""}`}
            />
          ))}
        </div>
        <div className="welcome-tour-nav">
          {step > 0 && (
            <button onClick={onBack} className="welcome-tour-back">
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (isLast) {
                onFinish();
                navigate("/courses/new");
                return;
              }
              onNext();
            }}
            className="welcome-tour-next"
          >
            {isLast ? "Start designing" : "Next"} <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
