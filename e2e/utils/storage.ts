import type { Page } from "@playwright/test";
import type { SeededProject } from "../fixtures/courseSeedBasic";

/**
 * The app persists projects under the localStorage key "studio:projects"
 * (see app/src/store/projects.ts). Tests seed the project before
 * navigating to /courses?project={id}, then clear in afterEach so the
 * next test starts clean.
 */

// Must match the constant in app/src/store/projects.ts. Hardcoded here
// rather than imported because store/projects.ts pulls in DOM globals
// at module load and Playwright's TS toolchain doesn't run a DOM env.
const STORAGE_KEY = "bcgu_studio_projects_v1";

/**
 * Visit the app's home so we have a same-origin context, then write the
 * seeded project into localStorage. Existing entries with the same id
 * are replaced.
 */
export async function seedCourseInStorage(page: Page, project: SeededProject): Promise<void> {
  // Relative path — joins against baseURL (which ends in /novoed-toolkit/).
  // A leading slash would strip the base path and 404.
  await page.goto("");
  await page.evaluate(({ key, project: p }) => {
    const all = JSON.parse(localStorage.getItem(key) || "[]") as Array<{ id: string }>;
    const idx = all.findIndex((entry) => entry.id === p.id);
    if (idx >= 0) all[idx] = p as never;
    else all.push(p as never);
    localStorage.setItem(key, JSON.stringify(all));
  }, { key: STORAGE_KEY, project });
}

/** Wipe every persisted project. Run in afterEach. */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, STORAGE_KEY);
}

/** Open the Course Studio canvas for a seeded course. */
export async function openCourse(page: Page, courseId: string): Promise<void> {
  await page.goto(`courses?project=${courseId}`);
  // Wait for the editor canvas to mount — the lesson title input is a
  // reliable signal both module-view and lesson-view share parent state
  // by the time it appears.
  await page.waitForSelector('input[placeholder="Untitled course"]', { timeout: 10_000 });
}
