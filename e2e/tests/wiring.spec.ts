import { test, expect } from "@playwright/test";
import { courseSeedBasic, COURSE_ID, LESSON_ID } from "../fixtures/courseSeedBasic";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";
import { installAgentMock } from "../mocks/agentMock";
import { cannedListStructure, cannedFiveMCQs } from "../mocks/cannedResponses";

/**
 * Wiring tests — clicking X dispatches Y. The agent is mocked so we
 * can assert what tool calls the FE makes (via the args we receive)
 * and what content lands when canned responses come back.
 *
 * Tighter scope than content tests: these pin the FE → agent → FE
 * round-trip, not the rendering.
 */
test.describe("Wiring: lesson knowledge check trigger", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedBasic());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('"Add a knowledge check" CTA prefills chat and writes the quiz', async ({ page }) => {
    await installAgentMock(page, [
      {
        userMessage: /knowledge check/i,
        toolCalls: [
          { name: "list_structure", args: {} },
          {
            name: "write_knowledge_check",
            args: {
              target_kind: "lesson",
              target_id: LESSON_ID,
              questions: cannedFiveMCQs(),
            },
          },
        ],
        assistantText: "Knowledge check added to lesson 1.1: Why change is hard.",
      },
    ]);

    await openCourse(page, COURSE_ID);

    // The KC CTA renders below the lesson body. Click it.
    await page.getByRole("button", { name: /add a knowledge check/i }).click();

    // The Copilot panel should be open with a prefilled message.
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 10_000 });
    await expect(composer).toBeEnabled({ timeout: 10_000 });
    const draft = await composer.inputValue();
    expect(draft).toMatch(/knowledge check/i);
    expect(draft).toContain("1.1");

    // Send the prefilled message — mock fires the canned tools.
    await composer.press("Enter");

    // The knowledge check section should now show 5 questions. We assert
    // on the question stems from cannedFiveMCQs to confirm the FE took
    // the mocked write_knowledge_check args and rendered them.
    await expect(page.getByText("Which factor most often derails")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Identify the strongest leading indicator")).toBeVisible();

    // Spot-check structure: a Regenerate button appears per question.
    const regenButtons = page.getByRole("button", { name: /regenerate/i });
    // Whole-section "Regenerate all" (1) + 5 per-question (5) = 6 total.
    await expect(regenButtons).toHaveCount(6);
  });

  test("list_structure response is consumed without surfacing tool noise", async ({ page }) => {
    await installAgentMock(page, [
      {
        toolCalls: [{ name: "list_structure", args: {} }],
        assistantText: "Here's the lay of the course.",
      },
    ]);

    await openCourse(page, COURSE_ID);
    await page.locator('button:has-text("Copilot")').click();
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 10_000 });
    await expect(composer).toBeEnabled({ timeout: 10_000 });
    await composer.fill("what's in the course?");
    await composer.press("Enter");

    // Assistant text lands.
    await expect(page.getByText("Here's the lay of the course.")).toBeVisible({ timeout: 5_000 });

    // Raw tool-call bubbles should NOT appear. #5h removed them.
    await expect(page.getByText(/list_structure\(/)).toHaveCount(0);
    await expect(page.getByText(/→ list_structure/)).toHaveCount(0);
  });
});
