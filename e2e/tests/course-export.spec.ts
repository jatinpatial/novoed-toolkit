import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";

/**
 * Course → Export → Word doc (#6c) — mocked.
 *
 * Asserts the wiring end-to-end without a real backend:
 *   click → POST /export/course-docx → blob → download triggered.
 *
 * The HTTP request is intercepted via page.route so the test can
 * assert the request body shape (course tree present, audience
 * field present) without the BE being up. The response is a
 * minimal fake .docx (PK header + filler) so the FE's blob /
 * download path runs.
 */
test.describe("Course → Export → Word doc", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("clicking the menu item POSTs the course tree and triggers a download", async ({ page }) => {
    let capturedBody: { course?: { title?: string; modules?: unknown[] }; audience?: string } | null = null;

    // Minimal valid-shape .docx: PK signature + filler. The FE only
    // cares that a non-empty blob comes back; deep validity isn't
    // exercised here (smoke spec covers real-content validation).
    const fakeDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK\x03\x04 — local file header
      Buffer.alloc(2048, 0x20),               // 2KB filler
    ]);

    await page.route("**/export/course-docx", async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers: { "Content-Disposition": 'attachment; filename="E2E_Test_Course-course.docx"' },
        body: fakeDocx,
      });
    });

    await openCourse(page, COURSE_ID);

    // Set up the download listener BEFORE clicking — Playwright requires
    // this ordering or the download promise resolves with no event.
    const downloadPromise = page.waitForEvent("download");

    // Open the Export dropdown.
    await page.getByRole("button", { name: /^export$/i }).click();
    // Click the new menu item.
    await page.getByRole("button", { name: /Course as Word doc/i }).click();

    const download = await downloadPromise;

    // Filename matches the FE's sanitization scheme.
    expect(download.suggestedFilename()).toMatch(/course\.docx$/i);

    // Request body sanity — course tree present, audience field present.
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.course?.title).toBe("E2E Test Course");
    expect(Array.isArray(capturedBody!.course?.modules)).toBe(true);
    expect(capturedBody!.course!.modules!.length).toBeGreaterThanOrEqual(1);
    // Audience is empty by default in #6c (Phase 2 wires a UI input);
    // assert the field exists, not its value.
    expect(capturedBody!.audience).toBeDefined();
  });
});
