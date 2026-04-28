import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";
import { installAgentMock } from "../mocks/agentMock";

/**
 * Tool-aware loading indicator (Phase 1 #5b/#5k).
 *
 * Catches the regression where the indicator stayed on "Thinking…" /
 * "Working" because new tools (write_knowledge_check etc.) were never
 * added to TOOL_LABELS in AgentChat.tsx. Each test below mocks one
 * tool turn, pauses before sending done, and asserts the indicator
 * shows the expected friendly label.
 */
test.describe("Copilot loading indicator: tool-aware labels", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  for (const { tool, expected } of [
    { tool: "list_structure", expected: "Looking up the course" },
    { tool: "read_materials", expected: "Reading your source materials" },
    { tool: "write_knowledge_check", expected: "Building the knowledge check" },
    { tool: "design_case_study", expected: "Designing the case study" },
    { tool: "regenerate_question", expected: "Regenerating that question" },
  ]) {
    test(`shows "${expected}…" while ${tool} is in flight`, async ({ page }) => {
      await installAgentMock(page, [
        {
          toolCalls: [{ name: tool, args: {} }],
          // Hold the indicator visible so the test has a window to assert.
          pauseAfterToolsMs: 800,
          assistantText: "Done.",
        },
      ]);

      await openCourse(page, COURSE_ID);

      // Open Copilot, send any message — mock fires the scripted tool.
      await page.locator('button:has-text("Copilot")').click();
      const composer = page.locator('textarea[placeholder="Message the copilot…"]');
      await composer.waitFor({ state: "visible", timeout: 10_000 });
      await expect(composer).toBeEnabled({ timeout: 10_000 });
      await composer.fill("go");
      await composer.press("Enter");

      // Indicator label should appear within the pause window.
      await expect(page.getByText(`${expected}…`, { exact: true })).toBeVisible({ timeout: 3_000 });
    });
  }

  test("falls back to Working… for tools not in the labels map", async ({ page }) => {
    await installAgentMock(page, [
      {
        toolCalls: [{ name: "set_brand", args: { brand: "bcg" } }],
        pauseAfterToolsMs: 800,
        assistantText: "Brand updated.",
      },
    ]);

    await openCourse(page, COURSE_ID);
    await page.locator('button:has-text("Copilot")').click();
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 10_000 });
    await expect(composer).toBeEnabled({ timeout: 10_000 });
    await composer.fill("switch brand");
    await composer.press("Enter");

    // set_brand is not in TOOL_LABELS — fallback should kick in.
    await expect(page.getByText("Working…", { exact: true })).toBeVisible({ timeout: 3_000 });
  });
});
