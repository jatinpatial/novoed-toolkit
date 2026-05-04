/**
 * Track-R4c: Pexels TOS attribution footer.
 *
 * Pexels' free-tier license requires "show a prominent link back to
 * Pexels (e.g. "Photos provided by Pexels")" wherever Pexels images
 * appear. This footer renders that line on the dashboard, project
 * library, and any other surface that displays Pexels-fetched
 * imagery. Lesson-banner photographer credits live separately on
 * the banner itself (LessonBanner) — that satisfies the per-photo
 * attribution.
 */
export function PexelsAttribution({ className = "" }: { className?: string }) {
  return (
    <div className={`pexels-attribution ${className}`.trim()}>
      Photos provided by{" "}
      <a
        href="https://www.pexels.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        Pexels
      </a>
    </div>
  );
}
