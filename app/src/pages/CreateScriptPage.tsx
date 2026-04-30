import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { useActiveBrand } from "../shell/TopBar";
import { B, type BrandKey } from "../brand/tokens";
import { saveProject } from "../store/projects";
import type { Course } from "../course/types";

/**
 * CreateScriptPage — standalone Synthesia script intake (Phase 2 #2 polish-3c).
 *
 * Third entry path on the dashboard hero:
 *
 *   primary           "Design course →"           full course path
 *   secondary pill    "Or fill in a structured
 *                     brief →"                    detailed course form (C0)
 *   tertiary link     "Just a video script?
 *                     Try Script Studio →"       this page
 *
 * Some LDs need just a 60-90 second video script — a Synthesia avatar
 * walk-through, a quick announcement, a scenario monologue. Forcing
 * them through the full course flow is friction; this page collects
 * the script-shaped intake (topic / audience / duration / tone /
 * speaker mode) and submits straight to the existing Synthesia
 * Scriptwriter (MODE 3 of the agent system prompt).
 *
 * Implementation choice — Option A from the polish-3c spec:
 *   On submit, create a 1-module / 1-lesson course with a single
 *   video block; save to localStorage; navigate to
 *   /courses?project=<id>&brief=<assembled>&autosend=1. CourseCanvas
 *   picks up the brief and fires the agent, which runs MODE 3 on the
 *   single video block.
 *
 * Option B (a dedicated /scripts/:id surface) is a follow-up if LDs
 * end up using this heavily and want a leaner standalone view.
 *
 * Page chrome: AppShell + section-header pattern (no MeshHero —
 * intake forms need focus, mesh chrome would distract).
 */

const DURATION_OPTIONS: Array<{ value: string; label: string; seconds: number }> = [
  { value: "30s",    label: "30 sec",  seconds: 30 },
  { value: "60s",    label: "60 sec",  seconds: 60 },
  { value: "90s",    label: "90 sec",  seconds: 90 },
  { value: "2min",   label: "2 min",   seconds: 120 },
  { value: "3min",   label: "3 min",   seconds: 180 },
  { value: "custom", label: "Custom",  seconds: 0 },
];

const TONE_OPTIONS = ["Conversational", "Authoritative", "Narrative"] as const;
const SPEAKER_OPTIONS: Array<{ value: "speaker" | "narration"; label: string }> = [
  { value: "speaker",   label: "On-camera" },
  { value: "narration", label: "Voice-over" },
];

const rid = () => "b" + Math.random().toString(36).slice(2, 10);

export default function CreateScriptPage() {
  const navigate = useNavigate();
  const [activeBrand, setActiveBrand] = useActiveBrand();

  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState<string>("90s");
  const [customDuration, setCustomDuration] = useState("");
  const [tone, setTone] = useState<typeof TONE_OPTIONS[number]>("Conversational");
  const [speakerMode, setSpeakerMode] = useState<"speaker" | "narration">("narration");
  const [notes, setNotes] = useState("");
  const [brand, setBrand] = useState<BrandKey>(activeBrand);

  const topicValid = topic.trim().length > 0;
  const audienceValid = audience.trim().length > 0;
  const durationValid =
    duration.length > 0 && (duration !== "custom" || customDuration.trim().length > 0);
  const isValid = topicValid && audienceValid && durationValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    // Resolve duration into a seconds count (custom uses LD's free-form text).
    const opt = DURATION_OPTIONS.find((d) => d.value === duration);
    const durationLabel =
      duration === "custom" ? customDuration.trim() : (opt?.label ?? "90 sec");
    const durationSeconds = duration === "custom" ? null : (opt?.seconds ?? 90);

    // Build the 1-module / 1-lesson / 1-video-block course shell. The
    // video block carries `videoType` from the form so MODE 3
    // (Synthesia Scriptwriter) picks the right voice/visual style
    // when it writes the script.
    const blockId = rid();
    const lessonId = rid();
    const moduleId = rid();
    const courseId = rid();
    const projectId = rid();
    const courseTitle = topic.trim().slice(0, 80) || "Synthesia script";

    const course: Course = {
      id: courseId,
      title: courseTitle,
      client: "",
      brand,
      modules: [
        {
          id: moduleId,
          title: "Script",
          weekNumber: 1,
          lessons: [
            {
              id: lessonId,
              title: "1.1 Video script",
              duration: durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : 2,
              blocks: [
                {
                  id: blockId,
                  type: "video",
                  data: { videoType: speakerMode },
                },
              ],
            },
          ],
        },
      ],
    };

    // Persist + sync brand BEFORE navigating so CourseCanvas reads the
    // correct project on mount. Same pattern as CreateCoursePage.
    setActiveBrand(brand);
    saveProject({
      id: projectId,
      name: courseTitle,
      kind: "course",
      brand,
      data: { kind: "course", course },
    });

    // Assemble the brief — same shape as buildVideoScriptPrefill in
    // CourseStudio.tsx but driven by the form fields. Agent calls
    // list_structure first (finds the video block by id), then
    // write_script.
    const briefLines = [
      `Write a ${speakerMode === "speaker" ? "speaker" : "voice-over"} Synthesia script for the video block on lesson 1.1.`,
      `Video block id: ${blockId}`,
      `Topic: ${topic.trim()}.`,
      `Audience: ${audience.trim()}.`,
      `Target: ~${durationLabel}.`,
      `Tone: ${tone.toLowerCase()}.`,
    ];
    if (notes.trim()) briefLines.push(`\nNotes: ${notes.trim()}`);
    const brief = briefLines.join("\n");

    navigate(
      `/courses?project=${encodeURIComponent(projectId)}&brief=${encodeURIComponent(brief)}&autosend=1`,
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
              <h2 className="section-title">Draft a Synthesia script.</h2>
              <p className="section-sub">
                Avatar-paced narration script. ~150 wpm. Brand-themed. Studio
                Copilot writes the SPOKEN / VISUAL scene structure; you refine
                in the block drawer.
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-7 stagger-children">
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

            <FormField label="Audience" required hint="Who's watching?">
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. senior managers leading restructurings"
                className="form-input"
                required
                aria-invalid={!audienceValid && audience.length > 0}
              />
            </FormField>

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

            <FormField label="Brand" hint="Theme used in preview & export. Defaults to your current setting.">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(B) as BrandKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBrand(k)}
                    className={
                      brand === k
                        ? "form-chip form-chip-active inline-flex items-center gap-2"
                        : "form-chip inline-flex items-center gap-2"
                    }
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                      style={{ background: B[k].pri }}
                      aria-hidden="true"
                    />
                    {B[k].n}
                  </button>
                ))}
              </div>
            </FormField>

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
