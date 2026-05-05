import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { MaterialsDropZone } from "../shell/MaterialsDropZone";
import { useActiveBrand } from "../shell/TopBar";
import { B, type BrandKey } from "../brand/tokens";
import { useAgent } from "../agent/AgentContext";

/**
 * CreateCoursePage — structured course-intake form (Phase 2 #2 C0).
 *
 * The detailed-brief flow that the dashboard's "Detailed brief →"
 * button (HeroComposer, B2b) routes to. For free-form quick briefs
 * the dashboard composer is right; for real BCG U courses where the
 * LD has thought about audience tier, prerequisites, sponsor
 * objectives, source materials, and brand, a structured form
 * collects the inputs Course Architect actually uses better than
 * free-form text — fewer follow-up questions, more accurate first-
 * pass outline.
 *
 * Sub-commit chain:
 *   C0a  route + page skeleton + composer button rewiring
 *   C0b (this)  7 form fields + state
 *   C0c         submit handler + brief assembly + /courses?brief=
 *   C0d         visual polish — section header pattern + brand strip
 *
 * Page chrome decision (per user spec): NO full <MeshHero> here.
 * The intake form needs focus and reading discipline; mesh chrome
 * would distract.
 *
 * Submission target (lands in C0c): /courses?brief=<encoded-brief>.
 * Same path the dashboard composer uses — Course Architect picks up
 * from there.
 */

// Duration chips. 7 chips per user spec — covers the BCG U sweet spot
// (4-6 week courses) plus shorter formats (workshop, single-day) and
// a custom escape hatch. Chips wrap on narrow viewports.
//
// `value` is the chip's machine identifier (used for state matching);
// `briefLabel` is what we splice into the assembled brief string sent
// to Course Architect. Keeping briefLabel separate from `label` lets
// the UI label read more conversationally ("2 hours") while the brief
// reads more structurally ("2-hour").
const DURATION_OPTIONS: Array<{ value: string; label: string; briefLabel: string }> = [
  { value: "30min",  label: "30 min",  briefLabel: "30-minute" },
  { value: "2hr",    label: "2 hours", briefLabel: "2-hour" },
  { value: "1day",   label: "1 day",   briefLabel: "1-day" },
  { value: "1week",  label: "1 week",  briefLabel: "1-week" },
  { value: "4weeks", label: "4 weeks", briefLabel: "4-week" },
  { value: "6weeks", label: "6 weeks", briefLabel: "6-week" },
  { value: "custom", label: "Custom",  briefLabel: "" /* uses customDuration */ },
];

// polish-3d: course-shape toggle options. Each chip group has an
// "auto" / "mixed" default that maps to the agent's current default
// behavior; LDs only touch these when they want to steer the shape.
type CaseStudiesValue = "auto" | "none" | "1" | "2" | "3";
type VideoScriptsValue = "auto" | "none" | "key" | "every";
type KnowledgeChecksValue = "auto" | "lesson" | "module" | "both";
type InteractivityValue = "light" | "mixed" | "heavy";

const CASE_STUDIES_OPTIONS: Array<{ value: CaseStudiesValue; label: string }> = [
  { value: "none", label: "None" },
  { value: "1",    label: "1" },
  { value: "2",    label: "2" },
  { value: "3",    label: "3" },
  { value: "auto", label: "Auto" },
];
const VIDEO_SCRIPTS_OPTIONS: Array<{ value: VideoScriptsValue; label: string }> = [
  { value: "none",  label: "None" },
  { value: "key",   label: "Key lessons" },
  { value: "every", label: "Every lesson" },
  { value: "auto",  label: "Auto" },
];
const KNOWLEDGE_CHECKS_OPTIONS: Array<{ value: KnowledgeChecksValue; label: string }> = [
  { value: "lesson", label: "Lesson-level" },
  { value: "module", label: "Module-level" },
  { value: "both",   label: "Both" },
  { value: "auto",   label: "Auto" },
];
const INTERACTIVITY_OPTIONS: Array<{ value: InteractivityValue; label: string }> = [
  { value: "light", label: "Light" },
  { value: "mixed", label: "Mixed" },
  { value: "heavy", label: "Heavy" },
];

export default function CreateCoursePage() {
  const navigate = useNavigate();
  // Field state — each field is a controlled input. Brand defaults to
  // the active brand so the LD doesn't have to re-pick what they
  // already have configured globally. setActiveBrand syncs the form's
  // chosen brand back to localStorage on submit so the new course
  // picks it up via CourseStudio's brand-from-active flow.
  const [activeBrand, setActiveBrand] = useActiveBrand();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [customDuration, setCustomDuration] = useState("");
  const [goals, setGoals] = useState("");
  const [brand, setBrand] = useState<BrandKey>(activeBrand);
  const [notes, setNotes] = useState("");
  // polish-3d: Course shape toggles. All default to auto/mixed so the
  // LD doesn't have to touch them; agent picks sensible defaults.
  const [caseStudies, setCaseStudies] = useState<CaseStudiesValue>("auto");
  const [videoScripts, setVideoScripts] = useState<VideoScriptsValue>("auto");
  const [knowledgeChecks, setKnowledgeChecks] = useState<KnowledgeChecksValue>("auto");
  const [interactivity, setInteractivity] = useState<InteractivityValue>("mixed");
  // Track-B (Phase 2 AI #3): source-material drop zone is shared
  // across CreateCoursePage + CreateKcPage. Files extract via /parse
  // → AgentContext.pendingMaterials. handleSubmit migrates onto the
  // course's materials list when the course is built.
  const { pendingMaterials } = useAgent();

  // Validation: audience non-empty, duration selected (and if custom,
  // customDuration non-empty).
  const audienceValid = audience.trim().length > 0;
  const durationValid =
    duration.length > 0 && (duration !== "custom" || customDuration.trim().length > 0);
  const isValid = audienceValid && durationValid;

  // C0c: assemble the structured brief into the conversational format
  // Course Architect already handles for free-form briefs from the
  // dashboard composer ("4-week change management for senior managers
  // leading restructurings"). The form's structure compiles down to a
  // similar shape so the agent's existing parsing path stays intact;
  // optional sections (goals, notes) only appear when the user filled
  // them in.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    // Resolve the duration into the brief's noun phrase. Standard chips
    // use briefLabel ("4-week"); custom uses the user's free-form
    // string verbatim.
    const opt = DURATION_OPTIONS.find((d) => d.value === duration);
    const durationLabel =
      duration === "custom" ? customDuration.trim() : (opt?.briefLabel ?? "");

    const titleClause = title.trim() ? ` titled "${title.trim()}"` : "";
    const lead = `${durationLabel} course${titleClause} for ${audience.trim()}.`;

    const sections: string[] = [lead];
    if (goals.trim()) sections.push(`\n\nGoals:\n${goals.trim()}`);

    // polish-3d: append "Course shape:" block when any toggle is off
    // its default. Auto/mixed values are omitted so the agent treats
    // them as "agent picks." Course Architect's MODE 1 prompt and
    // Lesson Writer's MODE 2 prompt both honor these constraints.
    const shapeLines: string[] = [];
    if (caseStudies !== "auto") {
      const label = caseStudies === "none" ? "None" : caseStudies;
      shapeLines.push(`  Case studies: ${label}`);
    }
    if (videoScripts !== "auto") {
      const label =
        videoScripts === "none" ? "None"
        : videoScripts === "key" ? "Key lessons only"
        : "Every lesson";
      shapeLines.push(`  Video scripts: ${label}`);
    }
    if (knowledgeChecks !== "auto") {
      const label =
        knowledgeChecks === "lesson" ? "Lesson-level"
        : knowledgeChecks === "module" ? "Module-level"
        : "Both";
      shapeLines.push(`  Knowledge checks: ${label}`);
    }
    if (interactivity !== "mixed") {
      shapeLines.push(`  Interactivity: ${interactivity}`);
    }
    if (shapeLines.length > 0) {
      sections.push("\n\nCourse shape:\n" + shapeLines.join("\n"));
    }

    if (notes.trim()) sections.push(`\n\nNotes:\n${notes.trim()}`);

    // Track-B: source-material hint. Course Architect's MODE 1 prompt
    // tells it to call read_materials when materials are attached;
    // explicitly naming the files in the brief makes that path
    // unambiguous and gives the agent something to reference in its
    // proposal commentary.
    if (pendingMaterials.length > 0) {
      const fileList = pendingMaterials.map((m) => `  - ${m.filename}`).join("\n");
      sections.push(
        `\n\nSource materials attached (read these via read_materials before proposing the outline):\n${fileList}`,
      );
    }
    const brief = sections.join("");

    // Sync active brand BEFORE navigating so the new course's brand
    // (set when buildCourseFromProposal runs in CourseStudio) reflects
    // the form's choice. The active brand is the source for new courses
    // until the LD opens an existing project.
    setActiveBrand(brand);

    // polish-2a bug 2: auto-send. The form has already collected enough
    // structured context from the LD (audience + duration + goals + notes
    // + brand) that asking them to click Send a second time after landing
    // in chat is friction without value. Pass autosend=1 — CourseStudio's
    // mount effect (next polish-2a edit) detects this and fires
    // sendMessage directly once the agent socket is open, instead of
    // prefilling the chat textarea.
    navigate(`/courses?brief=${encodeURIComponent(brief)}&autosend=1`);
  }

  return (
    /* C0d: AppShell switched to fullBleed so the .create-course-page
       wrapper's 4px brand-cascade strip can run edge-to-edge across
       the main pane (matching the .lesson-canvas-pane pattern from
       B3c). The inner content stays in a 768px reading column. */
    <AppShell fullBleed>
      <div className="create-course-page">
        <div className="max-w-3xl mx-auto px-8 md:px-12 py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>

          {/* C0d: section-header pattern (matches B2c "Three ways to
              start." rhythm so the form reads as part of the same
              product, not a separate utility). 32px h2 + 15px sub. */}
          <header className="section-header mb-12 animate-fade-up">
            <div>
              <h2 className="section-title">Design a course.</h2>
              <p className="section-sub">
                Tell Studio Copilot who it's for and what you want it to do.
                The agent drafts a weekly outline you can build with one click.
              </p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-7 stagger-children">
          {/* ── Field 1: Title (optional text) ─────────────────────── */}
          <FormField
            label="Course title"
            optional
            hint="The agent names it from your brief if you leave this blank."
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Leading Change in Pharma"
              className="form-input"
            />
          </FormField>

          {/* ── Field 2: Audience (required text) ──────────────────── */}
          <FormField
            label="Audience"
            required
            hint="Who's taking this? Role, seniority, context."
          >
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. senior managers in pharma leading restructurings"
              className="form-input"
              required
              aria-invalid={!audienceValid && audience.length > 0}
            />
          </FormField>

          {/* ── Field 3: Duration (required chip group) ────────────── */}
          <FormField
            label="Duration"
            required
            hint="How long is the course? Pick the closest, then refine in chat."
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
                placeholder="e.g. 3-week sprint, half-day workshop, 8-week cohort"
                className="form-input mt-3"
                autoFocus
              />
            )}
          </FormField>

          {/* ── Field 4: Learning goals (optional textarea) ────────── */}
          <FormField
            label="Learning goals"
            optional
            hint="What should learners be able to do after? One per line if you have several."
          >
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. Frame change announcements that minimize attrition&#10;e.g. Map stakeholder coalitions for restructurings"
              rows={3}
              className="form-textarea"
            />
          </FormField>

          {/* ── Field 5: Brand (chip group with swatches) ──────────── */}
          <FormField
            label="Brand"
            hint="Theme used in preview & export. Defaults to your current setting."
          >
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

          {/* ── polish-3d: Course shape section ─────────────────────
              Four chip groups for steering Course Architect + Lesson
              Writer. All default to auto/mixed; LDs only touch them
              when they want to override. The "Course shape:" block
              gets appended to the assembled brief only when at least
              one toggle is off-default — auto/mixed values omit
              from the brief so the agent uses its current behavior. */}
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-5 space-y-4">
            <div>
              <div className="text-sm font-bold text-ink-900 mb-1">Course shape</div>
              <p className="text-xs text-ink-500">
                Leave on Auto unless you want to steer the shape — agent picks sensible defaults.
              </p>
            </div>

            <FormShapeChips
              label="Case studies"
              options={CASE_STUDIES_OPTIONS}
              value={caseStudies}
              onChange={setCaseStudies}
            />
            <FormShapeChips
              label="Video scripts"
              options={VIDEO_SCRIPTS_OPTIONS}
              value={videoScripts}
              onChange={setVideoScripts}
            />
            <FormShapeChips
              label="Knowledge checks"
              options={KNOWLEDGE_CHECKS_OPTIONS}
              value={knowledgeChecks}
              onChange={setKnowledgeChecks}
            />
            <FormShapeChips
              label="Interactivity density"
              options={INTERACTIVITY_OPTIONS}
              value={interactivity}
              onChange={setInteractivity}
            />
          </div>

          {/* ── Field 6: Source materials — shared drop zone */}
          <FormField
            label="Source materials"
            hint="Drop a deck, PDF, or Word doc. The agent reads it and grounds the course in your content."
            optional
          >
            <MaterialsDropZone />
          </FormField>

          {/* ── Field 7: Notes for the agent (optional textarea) ───── */}
          <FormField
            label="Notes for the agent"
            optional
            hint="Anything else? Preferences, constraints, jargon to avoid, who NOT to write for."
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Keep tone direct, avoid academic framing. Don't lean on US-centric examples."
              rows={3}
              className="form-textarea"
            />
          </FormField>

          {/* Submit — assembles the brief and navigates to
              /courses?brief=<encoded>. CourseStudio prefills the chat
              composer with the brief; the LD reviews and presses
              Enter to fire Course Architect. */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isValid}
              className="btn-cta-primary"
            >
              Design course <ArrowRight size={14} strokeWidth={2.5} />
            </button>
            {!isValid && (
              <p className="text-caption text-ink-400 mt-2">
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

/**
 * FormField — label + optional/required hint + helper text + input slot.
 *
 * Inline component because every field on this page uses the same
 * shape; pulling to its own file would scatter the form's surface.
 * If a second form on a different page needs this pattern, lift to
 * shell/FormField.tsx then.
 */
/**
 * FormShapeChips — chip-row variant for the Course shape section
 * (polish-3d). Inline label on the left, chip group on the right,
 * sized tighter than the main FormField so the four toggle rows
 * stack without dominating the form. Used only inside the Course
 * shape card; not lifted to its own file because no other surface
 * needs the pattern today.
 */
function FormShapeChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-semibold text-ink-700 w-36 flex-shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              value === opt.value
                ? "form-chip form-chip-active text-[12px] py-1.5 px-3"
                : "form-chip text-[12px] py-1.5 px-3"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
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
  // Bug-fix NB2 (file-dialog double-open): switched outer wrapper
  // from <label> to <div>. The MaterialsDropZone is rendered as a
  // child of FormField — when wrapped in a <label>, browser auto-
  // triggers the file input's click on label-click AND our explicit
  // onClick triggers it again. Two dialogs. <div> keeps the layout
  // identical without the label's auto-focus side effect; text/
  // textarea/select inputs inside FormField still work fine — they
  // don't NEED the label association for click-to-focus (they're
  // visible+clickable directly).
  return (
    <div className="block">
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
    </div>
  );
}
