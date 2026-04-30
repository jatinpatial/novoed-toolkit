import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "../shell/AppShell";

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
 * C0 ships in four sub-commits:
 *   C0a (this)   route + page skeleton + composer button rewiring
 *   C0b          form fields + state (7 fields: title, audience,
 *                duration, goals, brand, source materials, notes)
 *   C0c          submit handler + brief assembly + navigate to
 *                /courses?brief=<assembled> (same destination as the
 *                dashboard quick-composer)
 *   C0d          visual polish — section header pattern, optional
 *                4px brand-cascade strip at page top
 *
 * Page chrome decision (per user spec): NO full <MeshHero> here.
 * The intake form needs focus and reading discipline; mesh chrome
 * would distract. Section header pattern + a subtle brand strip is
 * the right weight.
 *
 * Submission target: /courses?brief=<encoded-brief>. Same path the
 * dashboard composer uses — Course Architect picks up from there.
 * No new agent flow needed; the form just assembles a more structured
 * brief string.
 */
export default function CreateCoursePage() {
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

        {/* Form fields land in C0b. C0a ships the page skeleton so
            the route is live and the dashboard's "Detailed brief →"
            button has a destination. */}
        <div className="card-base p-6">
          <p className="text-body text-ink-500">
            Form fields coming in C0b — audience, duration, goals, brand,
            source materials, notes. Submit lands in C0c.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
