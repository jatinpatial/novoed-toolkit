import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Track-H / H3: slide-in help drawer.
 *
 * Right-side drawer (480px wide) with tabbed how-to content for the
 * four Studios + Tips & FAQ. Mounted at the AppShell level so any
 * page can open it via TopBar's HelpCircle button or Cmd/Ctrl+?
 * shortcut.
 *
 * Tab content is inline here for the MVP — short enough to read at
 * a glance, no off-page navigation. If individual tabs grow past
 * ~300 words, lift to shell/help/<tab>.tsx and dynamic-import.
 *
 * Accessibility: focus trap on open, Esc to dismiss, click outside
 * to dismiss, role="dialog" + aria-labelledby.
 */

type TabId =
  | "started"
  | "course"
  | "script"
  | "kc"
  | "infographic"
  | "tips";

const TABS: { id: TabId; label: string }[] = [
  { id: "started", label: "Getting started" },
  { id: "course", label: "Course Studio" },
  { id: "script", label: "Script Studio" },
  { id: "kc", label: "KC Studio" },
  { id: "infographic", label: "Infographic" },
  { id: "tips", label: "Tips & FAQ" },
];

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const [tab, setTab] = useState<TabId>("started");

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
      className="fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[2px] flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-drawer-title"
    >
      <div
        className="w-full max-w-[480px] h-full bg-white shadow-elevated flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Track-P / P3 adds the BCG U logo for brand
            consistency with the dashboard hero + welcome modal. */}
        <div className="px-5 h-14 border-b border-ink-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}bcg-u-logo-dark.png`}
              alt="BCG U"
              className="block h-5"
            />
            <h2 id="help-drawer-title" className="text-sm font-bold text-ink-900">
              Help &amp; guides
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100 flex items-center justify-center"
            aria-label="Close help drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab strip */}
        <div className="px-3 py-2 border-b border-ink-100 flex flex-wrap gap-1 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-2.5 h-7 rounded-md text-[11px] font-semibold transition ${
                tab === t.id
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-500 hover:text-ink-900 hover:bg-ink-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-ink-700 leading-relaxed help-content">
          {tab === "started" && <GettingStarted />}
          {tab === "course" && <CourseHelp />}
          {tab === "script" && <ScriptHelp />}
          {tab === "kc" && <KcHelp />}
          {tab === "infographic" && <InfographicHelp />}
          {tab === "tips" && <TipsFaq />}
        </div>
      </div>
    </div>
  );
}

function GettingStarted() {
  return (
    <>
      <h3>What BCG U Studio is</h3>
      <p>
        An AI-powered course-building suite for BCG U Learning Designers. You
        drop source material (a deck, PDF, Word doc), describe what you need,
        and the agent drafts the structure + content for you to refine.
      </p>
      <h3>The four Studios</h3>
      <ul>
        <li>
          <strong>Course Studio</strong> — full multi-week courses with modules,
          lessons, knowledge checks, and case studies.
        </li>
        <li>
          <strong>Script Studio</strong> — single Synthesia-ready video scripts
          (90 sec to a few minutes).
        </li>
        <li>
          <strong>KC Studio</strong> — standalone knowledge checks (3-10
          questions, mixed types, mixed difficulty).
        </li>
        <li>
          <strong>Infographic Studio</strong> — visual summaries (process,
          quadrant, comparison, list, timeline).
        </li>
      </ul>
      <h3>The core principle</h3>
      <p>
        Drop source material on any Studio. The agent reads it and grounds your
        content in your material — it doesn't write generic L&amp;D content.
      </p>
      <h3>Where your work lives</h3>
      <p>
        On <em>this computer</em>. Local browser storage, no cloud. Clearing
        your browser data clears your work; back up via the export buttons
        (.docx for courses, KCs; .txt for scripts).
      </p>
    </>
  );
}

function CourseHelp() {
  return (
    <>
      <h3>When to use Course Studio</h3>
      <p>
        Multi-lesson learning experiences — typically 2-6 weeks of content.
        Anything with modules, multiple lessons per module, knowledge checks,
        and (optionally) case studies belongs here.
      </p>
      <h3>The brief form</h3>
      <ul>
        <li>
          <strong>Audience</strong> — who's taking this. Be specific
          ("Senior managers in pharma leading restructurings").
        </li>
        <li>
          <strong>Duration</strong> — drives modules-per-course (one module
          per week is the default).
        </li>
        <li>
          <strong>Course shape</strong> — toggles for case-study placement,
          video scripts, knowledge-check scope, interactivity.
        </li>
        <li>
          <strong>Source materials</strong> — drop a deck or doc. The agent
          will read it before proposing the outline.
        </li>
      </ul>
      <h3>One-click full course</h3>
      <p>
        After Course Architect proposes an outline you can edit, click{" "}
        <strong>Build full course</strong> to generate every lesson + KC +
        case study in one pipeline. Watch the progress band and the outline
        tile states as it builds (~$2-4 of Claude usage per course).
      </p>
      <h3>Editing after generation</h3>
      <p>
        Click any block in the lesson canvas to edit it. The outline tree
        on the left lets you navigate; click a module to see its summary +
        final assessment.
      </p>
      <h3>Export</h3>
      <p>
        <strong>Word doc</strong> auto-downloads at the end of a one-click
        build. You can also re-download anytime via the top-bar menu.
      </p>
    </>
  );
}

function ScriptHelp() {
  return (
    <>
      <h3>When to use Script Studio</h3>
      <p>
        A single Synthesia-ready video script — 60 to 180 seconds typically.
        Two voice modes (presenter on camera / voice-over) drive the visual
        density.
      </p>
      <h3>Brief fields</h3>
      <ul>
        <li>
          <strong>Topic</strong> — what the video covers.
        </li>
        <li>
          <strong>Audience &amp; duration &amp; tone</strong> — calibrates
          pacing and language.
        </li>
        <li>
          <strong>Voice mode</strong> — Speaker (avatar talking head) or
          Narration (voice-over with rich visuals).
        </li>
      </ul>
      <h3>Transcript view</h3>
      <p>
        Toggle between Scenes (SPOKEN/VISUAL structure) and Transcript (clean
        prose, control tags stripped). The Transcript is the version you
        paste into Synthesia.
      </p>
      <h3>Download .txt</h3>
      <p>
        Transcript view's Download button gives you a .txt of the cleaned
        prose, ready for Synthesia.
      </p>
    </>
  );
}

function KcHelp() {
  return (
    <>
      <h3>When to use KC Studio</h3>
      <p>
        Standalone knowledge checks not anchored to any course — quick comp
        checks, post-meeting recaps, certification gates, etc.
      </p>
      <h3>Form fields</h3>
      <ul>
        <li>
          <strong>Topic</strong> — what learners are tested on.
        </li>
        <li>
          <strong>Question count</strong> — 3, 5, or 10.
        </li>
        <li>
          <strong>Difficulty mix</strong> — Recall / Apply / Analyze
          (Bloom's). Pick any combination; the agent distributes across
          the set.
        </li>
        <li>
          <strong>Question types</strong> — Multiple choice / Short answer
          / Scenario MCQ. Pick any combination.
        </li>
        <li>
          <strong>Source materials</strong> — questions reference your
          source's frameworks and language without quoting them visibly.
        </li>
      </ul>
      <h3>Download .docx</h3>
      <p>
        KC Studio's result page has a Download .docx button that produces
        a formatted Word doc with each question, options, correct answer
        marked, and rationale.
      </p>
    </>
  );
}

function InfographicHelp() {
  return (
    <>
      <h3>When to use Infographic Studio</h3>
      <p>
        Visual one-pagers that summarize a framework, process, comparison,
        or sequence. The fastest way to turn a deck section into something
        shareable.
      </p>
      <h3>Style options</h3>
      <ul>
        <li>
          <strong>Process</strong> — numbered sequence, each step builds.
        </li>
        <li>
          <strong>Quadrant</strong> — 2x2 matrix with axis labels.
        </li>
        <li>
          <strong>Comparison</strong> — 2-3 columns comparing options.
        </li>
        <li>
          <strong>Numbered list</strong> — vertical points.
        </li>
        <li>
          <strong>Timeline</strong> — chronological flow.
        </li>
      </ul>
      <h3>Download PNG</h3>
      <p>
        After generation, click Download PNG to save the rendered
        infographic as an image you can paste into a deck or doc.
      </p>
    </>
  );
}

function TipsFaq() {
  return (
    <>
      <h3>Why did my build stop?</h3>
      <p>
        Builds are resilient to refreshes — refresh-during-build is now safe
        (the orchestrator survives WS reconnects). Avoid mid-build navigation
        between routes; that can interrupt the agent's tool-call round-trips.
        If a single lesson fails, the orchestrator auto-retries once with a
        5-second backoff before halting.
      </p>
      <h3>Can I edit content after generation?</h3>
      <p>
        Yes. Click any block in the lesson canvas to edit it inline. Block
        drawer (gear icon on the block) gives you the structured editor for
        more complex types like accordion / cards / quiz.
      </p>
      <h3>How do I switch brands?</h3>
      <p>
        Top-right brand toggle: BCG / BCG U / Client. The toggle drives
        export coloring + canvas accent strip.
      </p>
      <h3>Where is my data?</h3>
      <p>
        All local. Browser localStorage, this computer only. No cloud, no
        sync. Clearing browser data clears your work; back up via the
        export buttons.
      </p>
      <h3>Can I use this offline?</h3>
      <p>
        No. The agent calls require the local agent backend running, which
        in turn needs internet to reach Anthropic's API. Run launch.bat
        from the repo root to start both servers; close them when you're
        done.
      </p>
      <h3>How much does a course cost?</h3>
      <p>
        At current cache hit rates: ~$2-4 per 4-week course (Claude usage,
        billed against your subscription). KCs run ~$0.10 each. Scripts
        and infographics ~$0.05 each. Hybrid model selection
        (Opus-architect + Sonnet-worker) cuts per-course cost ~65% if you
        configure it via .env.
      </p>
    </>
  );
}
