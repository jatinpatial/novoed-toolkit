import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mic, Upload, Headphones } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { saveScript, type Script } from "../store/scripts";

/**
 * CreateScriptPage — standalone Synthesia script intake (Phase 2 #2 polish-3c,
 * cleaned up in polish-4a).
 *
 * Third entry path on the dashboard hero. Some LDs need just a 60-90
 * second video script — a Synthesia avatar walk-through, a quick
 * announcement, a scenario monologue. Forcing them through the full
 * course flow is friction; this page collects the script-shaped intake
 * and submits straight to the Script Studio surface.
 *
 * polish-4a changes:
 *   - DROPPED the Brand chip group. Scripts are brand-agnostic at
 *     generation time — the Synthesia avatar's voice doesn't change
 *     per brand, and theming applies at course/export time when the
 *     script ends up inside a course or exported as .docx.
 *   - Submit creates a Script (separate localStorage namespace
 *     bcgu_studio_scripts_v1) rather than a fake 1-module-1-lesson
 *     course. Navigates to /scripts/:id?autosend=1.
 *   - ScriptStudio (the new /scripts/:id surface) renders a focused
 *     script editor + chat — no outline tree, no lesson canvas chrome,
 *     no brand toggle. See app/src/pages/ScriptStudio.tsx.
 *
 * Page chrome reuses CreateCoursePage's section-header pattern +
 * brand-cascade strip — vocabulary consistency across the two intake
 * forms.
 */

// Track-PC: duration options are format-aware. Synthesia videos run
// 30s-3min; podcast episodes typically run 5-15 min.
const SYNTHESIA_DURATION_OPTIONS: Array<{ value: string; label: string; seconds: number }> = [
  { value: "30s",    label: "30 sec",  seconds: 30 },
  { value: "60s",    label: "60 sec",  seconds: 60 },
  { value: "90s",    label: "90 sec",  seconds: 90 },
  { value: "2min",   label: "2 min",   seconds: 120 },
  { value: "3min",   label: "3 min",   seconds: 180 },
  { value: "custom", label: "Custom",  seconds: 0 },
];
const PODCAST_DURATION_OPTIONS: Array<{ value: string; label: string; seconds: number }> = [
  { value: "5min",   label: "5 min",   seconds: 300 },
  { value: "8min",   label: "8 min",   seconds: 480 },
  { value: "12min",  label: "12 min",  seconds: 720 },
  { value: "15min",  label: "15 min",  seconds: 900 },
  { value: "custom", label: "Custom",  seconds: 0 },
];

const TONE_OPTIONS = ["Conversational", "Authoritative", "Narrative"] as const;
const SPEAKER_OPTIONS: Array<{ value: "speaker" | "narration"; label: string }> = [
  { value: "speaker",   label: "On-camera" },
  { value: "narration", label: "Voice-over" },
];

const rid = () => "s" + Math.random().toString(36).slice(2, 10);

export default function CreateScriptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Track-PC: format toggles between Synthesia video script (existing
  // SCENE / SPOKEN / VISUAL spec) and Podcast dialogue (NotebookLM-
  // style 2-host conversation). Format change re-defaults duration to
  // a sensible per-format value so the LD doesn't pick "30 sec" for a
  // podcast. Initial format reads from ?format=podcast so the
  // Podcast Studio tile in SuiteTiles lands users in the right mode.
  const initialFormat: "synthesia" | "podcast" =
    searchParams.get("format") === "podcast" ? "podcast" : "synthesia";
  const [format, setFormat] = useState<"synthesia" | "podcast">(initialFormat);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState<string>(
    initialFormat === "podcast" ? "8min" : "90s",
  );
  const [customDuration, setCustomDuration] = useState("");
  const [tone, setTone] = useState<typeof TONE_OPTIONS[number]>("Conversational");
  const [speakerMode, setSpeakerMode] = useState<"speaker" | "narration">("narration");
  const [hostA, setHostA] = useState("Alex");
  const [hostB, setHostB] = useState("Jordan");
  const [notes, setNotes] = useState("");

  const DURATION_OPTIONS = format === "podcast"
    ? PODCAST_DURATION_OPTIONS
    : SYNTHESIA_DURATION_OPTIONS;

  const topicValid = topic.trim().length > 0;
  const audienceValid = audience.trim().length > 0;
  const durationValid =
    duration.length > 0 && (duration !== "custom" || customDuration.trim().length > 0);
  const isValid = topicValid && audienceValid && durationValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const opt = DURATION_OPTIONS.find((d) => d.value === duration);
    const durationLabel =
      duration === "custom" ? customDuration.trim() : (opt?.label ?? "90 sec");

    // polish-4a: persist the Script in its own store. The Script.id
    // doubles as the agent's video-block id when ScriptStudio's
    // synthetic-course wrapper exposes it via list_structure — that
    // way the existing MODE 3 (Synthesia Scriptwriter) tool path
    // works unchanged. See ScriptStudio.tsx for the wrapper.
    const scriptId = rid();
    const now = Date.now();
    const script: Script = {
      id: scriptId,
      title:
        topic.trim().slice(0, 80) ||
        (format === "podcast" ? "Podcast script" : "Synthesia script"),
      topic: topic.trim(),
      audience: audience.trim(),
      duration: durationLabel,
      tone,
      speakerMode,
      format,
      podcastHostA: format === "podcast" ? hostA.trim() || "Alex" : undefined,
      podcastHostB: format === "podcast" ? hostB.trim() || "Jordan" : undefined,
      notes: notes.trim(),
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    saveScript(script);

    // ScriptStudio's mount effect detects ?autosend=1 and fires the
    // brief once the agent socket opens. The brief mirrors
    // buildVideoScriptPrefill's shape so MODE 3 picks it up cleanly.
    let brief: string;
    if (format === "podcast") {
      // Track-PC: podcast brief routes the agent to its podcast
      // dialogue path (MODE 3 will branch on `Podcast format` cue).
      // We pass host names + duration explicitly so the agent doesn't
      // guess them.
      const hA = hostA.trim() || "Alex";
      const hB = hostB.trim() || "Jordan";
      const briefLines = [
        `Write a ${tone.toLowerCase()} podcast script as a 2-host dialogue.`,
        `Format: Podcast (NotebookLM-style — two hosts in conversation, NOT a Synthesia video).`,
        `Video block id: ${scriptId}`,
        `Topic: ${topic.trim()}.`,
        `Audience: ${audience.trim()}.`,
        `Target duration: ~${durationLabel}.`,
        `Host A name: ${hA}`,
        `Host B name: ${hB}`,
        `Output format: alternating dialogue lines labeled "${hA.toUpperCase()}:" and "${hB.toUpperCase()}:" — one beat per line, conversational rhythm. NO scene markers, NO visual cues.`,
      ];
      if (notes.trim()) briefLines.push(`\nNotes: ${notes.trim()}`);
      brief = briefLines.join("\n");
    } else {
      const briefLines = [
        `Write a ${tone.toLowerCase()} ${speakerMode === "speaker" ? "on-camera speaker" : "voice-over"} Synthesia script.`,
        `Video block id: ${scriptId}`,
        `Topic: ${topic.trim()}.`,
        `Audience: ${audience.trim()}.`,
        `Target: ~${durationLabel}.`,
      ];
      if (notes.trim()) briefLines.push(`\nNotes: ${notes.trim()}`);
      brief = briefLines.join("\n");
    }

    navigate(
      `/scripts/${encodeURIComponent(scriptId)}?brief=${encodeURIComponent(brief)}&autosend=1`,
    );
  }

  return (
    <AppShell fullBleed>
      <div className="create-course-page">
        <div className="max-w-3xl mx-auto px-8 md:px-12 py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>

          <header className="section-header mb-12 animate-fade-up">
            <div>
              <h2 className="section-title">
                {format === "podcast" ? "Draft a podcast script." : "Draft a Synthesia script."}
              </h2>
              <p className="section-sub">
                {format === "podcast"
                  ? "2-host dialogue, NotebookLM-style — but fully editable. Studio Copilot writes the conversation; you refine in Script Studio. Future iteration adds TTS audio export."
                  : "Avatar-paced narration script. ~150 wpm. Studio Copilot writes the SPOKEN / VISUAL scene structure; you refine in Script Studio."}
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-7 stagger-children">
            {/* Track-PC: Format toggle is the FIRST decision the LD makes
                — it changes which downstream fields apply (host names
                appear for podcast; speaker/visual options apply only to
                Synthesia). Visual treatment is two big cards rather than
                a chip group so the choice reads as significant. */}
            <FormField label="Format" required>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormat("synthesia");
                    setDuration("90s");
                  }}
                  className={
                    format === "synthesia"
                      ? "form-format-card form-format-card-active"
                      : "form-format-card"
                  }
                >
                  <Mic size={22} strokeWidth={2} className="mb-2" />
                  <div className="text-sm font-bold mb-0.5">Synthesia video</div>
                  <div className="text-[11px] opacity-80 leading-snug">
                    Single-presenter avatar script, SCENE / SPOKEN / VISUAL.
                    30 sec – 3 min.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormat("podcast");
                    setDuration("8min");
                  }}
                  className={
                    format === "podcast"
                      ? "form-format-card form-format-card-active"
                      : "form-format-card"
                  }
                >
                  <Headphones size={22} strokeWidth={2} className="mb-2" />
                  <div className="text-sm font-bold mb-0.5 inline-flex items-center gap-1.5">
                    Podcast
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">New</span>
                  </div>
                  <div className="text-[11px] opacity-80 leading-snug">
                    2-host dialogue, NotebookLM-style. Editable. 5-15 min.
                  </div>
                </button>
              </div>
            </FormField>

            <FormField label="Topic" required hint="What's the script about?">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Frame a restructuring announcement in pharma"
                className="form-input"
                required
                aria-invalid={!topicValid && topic.length > 0}
              />
            </FormField>

            <FormField
              label="Audience"
              required
              hint={format === "podcast" ? "Who's listening?" : "Who's watching?"}
            >
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={
                  format === "podcast"
                    ? "e.g. consultants commuting / multitasking"
                    : "e.g. senior managers leading restructurings"
                }
                className="form-input"
                required
                aria-invalid={!audienceValid && audience.length > 0}
              />
            </FormField>

            {/* Track-PC: Host names — only relevant for podcast format.
                Defaults Alex / Jordan are gender-neutral and work in
                most contexts. LD can rename for character / brand. */}
            {format === "podcast" && (
              <FormField
                label="Host names"
                hint="Defaults are gender-neutral. Rename to fit the show."
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                      Host A
                    </div>
                    <input
                      type="text"
                      value={hostA}
                      onChange={(e) => setHostA(e.target.value)}
                      placeholder="Alex"
                      className="form-input"
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                      Host B
                    </div>
                    <input
                      type="text"
                      value={hostB}
                      onChange={(e) => setHostB(e.target.value)}
                      placeholder="Jordan"
                      className="form-input"
                      maxLength={40}
                    />
                  </div>
                </div>
              </FormField>
            )}

            <FormField
              label="Duration"
              required
              hint="Avatar-paced ≈150 words/minute. Pick the closest, or set custom."
            >
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={
                      duration === opt.value ? "form-chip form-chip-active" : "form-chip"
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === "custom" && (
                <input
                  type="text"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder='e.g. "45 sec", "between 60 and 90 seconds"'
                  className="form-input mt-3"
                  autoFocus
                />
              )}
            </FormField>

            <FormField label="Tone" hint="Voice the avatar takes.">
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={
                      tone === t ? "form-chip form-chip-active" : "form-chip"
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Track-PC: Speaker mode applies only to Synthesia format —
                podcasts have two hosts in dialogue, no on-camera/voice-
                over distinction. Hidden when format=podcast. */}
            {format === "synthesia" && (
              <FormField
                label="Speaker mode"
                hint="On-camera = avatar talking head with sparse visuals. Voice-over = narration over rich full-screen visuals."
              >
                <div className="flex flex-wrap gap-2">
                  {SPEAKER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSpeakerMode(opt.value)}
                      className={
                        speakerMode === opt.value ? "form-chip form-chip-active" : "form-chip"
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>
            )}

            <FormField
              label="Source materials"
              hint="Drop a deck or transcript and the agent grounds the script in it."
            >
              <div className="form-soon-dropzone" aria-disabled="true">
                <Upload size={20} className="text-ink-400 mb-2" aria-hidden="true" />
                <div className="text-sm font-semibold text-ink-700 mb-1">
                  Drop a deck or transcript here
                </div>
                <div className="text-xs text-ink-500">PPTX · PDF · DOCX · TXT</div>
                <span className="form-soon-pill">Coming soon</span>
              </div>
            </FormField>

            <FormField label="Notes for the agent" optional hint="Anything else? Pacing preferences, jargon to avoid, named individuals to mention.">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Open with a concrete pharma scenario. Avoid US-centric examples. Don't name specific drugs."
                rows={3}
                className="form-textarea"
              />
            </FormField>

            {/* polish-4a: Brand chip group dropped. Scripts are brand-
                agnostic at generation time; theming applies at export. */}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!isValid}
                className="btn-cta-primary"
              >
                Draft the script <ArrowRight size={14} strokeWidth={2.5} />
              </button>
              {!isValid && (
                <p className="text-caption text-ink-400 mt-2">
                  {!topicValid && "Topic is required. "}
                  {!audienceValid && "Audience is required. "}
                  {!durationValid && "Pick a duration to continue."}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function FormField({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-sm font-bold text-ink-900">{label}</span>
        {required && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
            Required
          </span>
        )}
        {optional && !required && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
            Optional
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-ink-500 mb-2">{hint}</div>}
      {children}
    </label>
  );
}
