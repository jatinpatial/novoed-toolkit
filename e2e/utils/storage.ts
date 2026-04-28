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
 * Inject the seeded project so it lands in localStorage BEFORE any
 * navigation. This matters because the AgentProvider opens a WebSocket
 * on mount — if a WS-mocking test seeded via a goto-then-evaluate path,
 * the first navigation would start the WS before the mock route was
 * installed and the connection would miss it. addInitScript runs in
 * each new page context before any script executes, so the seed is
 * always in place by the time React boots.
 */
export async function seedCourseInStorage(page: Page, project: SeededProject): Promise<void> {
  await page.addInitScript(({ key, project: p }) => {
    const all = JSON.parse(localStorage.getItem(key) || "[]") as Array<{ id: string }>;
    const idx = all.findIndex((entry) => entry.id === p.id);
    if (idx >= 0) all[idx] = p as never;
    else all.push(p as never);
    localStorage.setItem(key, JSON.stringify(all));
  }, { key: STORAGE_KEY, project });
}

/**
 * Wipe every persisted project. afterEach hook so tests don't leak.
 * Tolerates "no page yet" state — first beforeEach in a clean context
 * doesn't have a navigated page to evaluate against.
 */
export async function clearStorage(page: Page): Promise<void> {
  if (page.url() === "about:blank") return;
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
