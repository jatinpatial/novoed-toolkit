/**
 * Sample-course seeder (Track-CC / CC3).
 *
 * On first launch, drops 2 example courses into the projects library so
 * a new LD sees "what good looks like" before building anything. Idempotent
 * via the studio.sampleCoursesSeeded flag — runs once per browser profile.
 *
 * Source JSON lives in app/public/sample-courses/. Files are fetched at
 * runtime (not bundled) so updating a sample doesn't require a rebuild —
 * you can drop a new JSON and the next first-launch picks it up.
 *
 * Each sample is wrapped into a course-kind Project so it appears in the
 * normal Recent Work strip alongside LD-built projects. The id is
 * prefixed with "sample-" so we can tell samples apart later (e.g. for
 * hide / un-seed).
 */
import type { Course } from "../course/types";
import { saveProject, listProjects, uid } from "./projects";

const SEEDED_FLAG = "studio.sampleCoursesSeeded";

const SAMPLE_FILES = [
  "difficult-feedback.json",
  "stakeholder-management.json",
];

function hasSeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_FLAG) === "1";
  } catch {
    return true; // Privacy mode etc. — pretend we already seeded so we don't keep retrying.
  }
}

function markSeeded(): void {
  try {
    localStorage.setItem(SEEDED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

/** Idempotent. Safe to call on every dashboard mount. */
export async function seedSampleCoursesIfNeeded(): Promise<void> {
  if (hasSeeded()) return;
  // Defensive: if the user already has projects, don't seed (they're an
  // existing LD upgrading to a build with this feature). Only fresh
  // dashboards get the samples.
  if (listProjects().length > 0) {
    markSeeded();
    return;
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  for (const file of SAMPLE_FILES) {
    try {
      const url = `${base}/sample-courses/${file}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[sample-courses] ${file} fetch returned ${resp.status}`);
        continue;
      }
      const course = (await resp.json()) as Course;
      const projectId = uid();
      saveProject({
        id: projectId,
        name: course.title,
        kind: "course",
        brand: course.brand,
        data: { kind: "course", course: { ...course, id: projectId } },
      });
    } catch (err) {
      console.warn(`[sample-courses] failed to seed ${file}:`, err);
    }
  }
  markSeeded();
}
