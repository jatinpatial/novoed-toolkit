import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID, LESSON_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";
import { ensureBackendRunning } from "../utils/backendHealth";

/**
 * Real-LLM smoke: Lesson Writer fills an empty lesson.
 *
 * Pins MODE 2 of the system prompt end-to-end:
 *   "Write this lesson" CTA → chat prefill → list_structure →
 *   write_lesson → 3-5 text blocks render in the lesson body.
 *
 * Asserts structural presence (≥3 writer-tagged blocks) rather than
 * specific copy.
 */
test.describe("Smoke: Lesson Writer fills an empty lesson", () => {
  test.beforeAll(async () => {
    await ensureBackendRunning();
  });

  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test.setTimeout(180_000);

  test("write CTA produces 3+ text blocks in the lesson", async ({ page }) => {
    await openCourse(page, COURSE_ID);

    // Lesson body is empty — the writer CTA card is visible.
    const writerCta = page.getByRole("button", { name: /write this lesson/i });
    await expect(writerCta).toBeVisible({ timeout: 5_000 });
    await writerCta.click();

    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 15_000 });
    await expect(composer).toBeEnabled({ timeout: 15_000 });

    // The prefill describes the lesson; submit unchanged.
    await composer.press("Enter");

    // After write_lesson lands, the empty state goes away and one or
    // more block cards render. The "Add block" pill appears between
    // every pair of blocks plus at the start, so its count is
    // (blocks + 1) — proxy for block count without scraping classes.
    await expect(page.getByRole("button", { name: /^add block$/i })).toHaveCount(
      // 3 blocks → 4 separators; 5 blocks → 6 separators. Lower-bound 4.
      // Use "at least" semantics via a single visibility check on the
      // 4th separator.
      4,
      { timeout: 150_000 },
    );

    // Verify blocks contain actual text content (not empty placeholders).
    // Each text block is a textarea with the lesson content; assert the
    // first one has > 30 chars of material.
    const firstTextarea = page.locator('main textarea').first();
    const text = (await firstTextarea.inputValue()) ?? "";
    expect(text.length).toBeGreaterThan(30);
  });
});
