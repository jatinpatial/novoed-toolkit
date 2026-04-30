import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { useActiveBrand } from "../shell/TopBar";
import { B, type BrandKey } from "../brand/tokens";

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
const DURATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "30min",  label: "30 min" },
  { value: "2hr",    label: "2 hours" },
  { value: "1day",   label: "1 day" },
  { value: "1week",  label: "1 week" },
  { value: "4weeks", label: "4 weeks" },
  { value: "6weeks", label: "6 weeks" },
  { value: "custom", label: "Custom" },
];

export default function CreateCoursePage() {
  // Field state — each field is a controlled input. Brand defaults to
  // the active brand so the LD doesn't have to re-pick what they
  // already have configured globally.
  const [activeBrand] = useActiveBrand();
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [customDuration, setCustomDuration] = useState("");
  const [goals, setGoals] = useState("");
  const [brand, setBrand] = useState<BrandKey>(activeBrand);
  const [notes, setNotes] = useState("");
  // Source materials: Soon-flagged drop zone in C0b — no wiring yet
  // (deferred to the Phase 2 AI sprint's deck-drop ingestion).

  // Validation: audience non-empty, duration selected (and if custom,
  // customDuration non-empty). C0c wires this to a submit handler.
  const audienceValid = audience.trim().length > 0;
  const durationValid =
    duration.length > 0 && (duration !== "custom" || customDuration.trim().length > 0);
  const isValid = audienceValid && durationValid;
  // C0c reads isValid for the submit button disabled state and
  // attaches the actual submit handler. C0b just renders the fields.
  void isValid;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <header className="mb-10">
          <h1 className="text-h1 text-ink-900 mb-2">Design a course.</h1>
          <p className="text-body-lg text-ink-500">
            Tell Studio Copilot who it's for and what you want it to do. The
            agent drafts a weekly outline you can build with one click.
          </p>
        </header>

        <form
          /* C0c attaches onSubmit. C0b only wires field state. */
          onSubmit={(e) => e.preventDefault()}
          className="space-y-7"
        >
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

          {/* ── Field 6: Source materials (Soon, drop zone placeholder) */}
          <FormField
            label="Source materials"
            hint="Drop a deck or reading and the agent grounds the course in it."
          >
            <div className="form-soon-dropzone" aria-disabled="true">
              <Upload size={20} className="text-ink-400 mb-2" aria-hidden="true" />
              <div className="text-sm font-semibold text-ink-700 mb-1">
                Drop a deck or PDF here
              </div>
              <div className="text-xs text-ink-500">
                PPTX · PDF · DOCX
              </div>
              <span className="form-soon-pill">Coming soon</span>
            </div>
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

          {/* Submit button placeholder — C0c wires the actual handler
              + brief assembly + navigation to /courses?brief=. */}
          <div className="pt-2">
            <button
              type="submit"
              disabled
              className="btn-cta-primary"
            >
              Design course →
            </button>
            <p className="text-caption text-ink-400 mt-2">
              Submit wires up in C0c.
            </p>
          </div>
        </form>
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
