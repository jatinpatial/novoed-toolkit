import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";
import { installAgentMock } from "../mocks/agentMock";

/**
 * Markdown rendering in the Copilot chat (Phase 1 #5k).
 *
 * Catches the regression we hit manually: agent emits `**bold**` and
 * `- bullets`, chat renders them as raw asterisks/dashes.
 *
 * Mocked WS sends an assistant_text payload with markdown formatting.
 * The test asserts the rendered DOM has actual <strong>, <em>, <ul>
 * elements rather than raw markup.
 */
test.describe("Copilot chat: markdown rendering", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("agent reply with **bold**, *italic*, and a bulleted list renders formatted", async ({ page }) => {
    await installAgentMock(page, [
      {
        // Match any user_message — only one turn in this test.
        assistantText: "Here is **bold text** and *italic text* and a list:\n- first bullet\n- second bullet",
      },
    ]);

    await openCourse(page, COURSE_ID);

    // Open the floating Copilot panel.
    await page.locator('button:has-text("Copilot")').click();

    // React 18 StrictMode double-mounts AgentProvider in dev. The first
    // mount opens a WS, the cleanup closes it, the second mount opens
    // a new WS — and useAgentSocket's reconnect timer fires 2s later.
    // The composer is disabled until that second connection establishes
    // (placeholder switches from "Connecting…" to "Message the copilot…").
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 10_000 });
    await expect(composer).toBeEnabled({ timeout: 10_000 });

    await composer.fill("hello");
    await composer.press("Enter");

    // The assistant reply should land as a bubble with formatted content,
    // not raw markdown.
    const replyBubble = page.locator('text=bold text').first();
    await expect(replyBubble).toBeVisible({ timeout: 5_000 });

    // Strong, emphasis, and unordered list elements should be in the DOM.
    await expect(page.locator("strong:has-text('bold text')")).toBeVisible();
    await expect(page.locator("em:has-text('italic text')")).toBeVisible();
    await expect(page.locator("ul li").first()).toContainText("first bullet");
    await expect(page.locator("ul li").nth(1)).toContainText("second bullet");

    // Raw markdown shouldn't be rendered as text. Asterisks and dashes
    // must not appear in the visible bubble copy.
    const bubbleText = await page.locator("text=bold text").first().textContent();
    expect(bubbleText).not.toContain("**");
    expect(bubbleText).not.toContain("- ");
  });
});
