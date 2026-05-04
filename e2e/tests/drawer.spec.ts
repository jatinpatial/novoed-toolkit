import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";

/**
 * Drawer width toggle (Phase 1 #5a).
 *
 * Vertical-slice test that exercises every layer of the harness:
 * fixture → localStorage seed → vite (auto-spun by Playwright) → React
 * boot → DOM assertions. No agent / WS traffic; the drawer toggle is
 * pure FE behavior.
 *
 * Catches regressions in:
 *   - Storage seed plumbing
 *   - Course → CourseStudio routing under the / base
 *   - BlockDrawer mount + visibility of the size-toggle button
 *   - The narrow → wide → fullscreen → narrow cycle in #5a's CSS
 */
test.describe("Block drawer width toggle", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("cycles narrow → wide → fullscreen → narrow", async ({ page }) => {
    await openCourse(page, COURSE_ID);

    // Open the video block drawer via the gear icon.
    await page.locator('button[title="Edit contents"]').first().click();

    const drawer = page.locator('aside').filter({ hasText: "Block settings" });
    await expect(drawer).toBeVisible();

    // narrow (380px) — initial state
    await expect(drawer).toHaveCSS("width", "380px");
    const sizeToggle = drawer.locator(
      'button[title="Expand to wide view"], button[title="Expand to full screen"], button[title="Collapse to narrow"]',
    );
    await expect(sizeToggle).toHaveAttribute("title", "Expand to wide view");

    // → wide (720px)
    await sizeToggle.click();
    await expect(drawer).toHaveCSS("width", "720px");
    await expect(sizeToggle).toHaveAttribute("title", "Expand to full screen");

    // → fullscreen overlay (position: fixed; inset: 0)
    await sizeToggle.click();
    await expect(drawer).toHaveCSS("position", "fixed");
    await expect(sizeToggle).toHaveAttribute("title", "Collapse to narrow");

    // → back to narrow
    await sizeToggle.click();
    await expect(drawer).toHaveCSS("width", "380px");
    await expect(sizeToggle).toHaveAttribute("title", "Expand to wide view");
  });
});
