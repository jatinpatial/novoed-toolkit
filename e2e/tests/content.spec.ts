import { test, expect } from "@playwright/test";
import { COURSE_ID } from "../fixtures/courseSeedBasic";
import { courseSeedWithCaseStudySlot, CASE_STUDY_ID } from "../fixtures/seedHelpers";
import { seedCourseInStorage, clearStorage, openCourse } from "../utils/storage";
import { installAgentMock } from "../mocks/agentMock";

/**
 * Content-presence tests — does generated content land in the right
 * places after a mocked agent turn? Different from wiring tests:
 * wiring asserts "click X dispatched Y", content asserts "the
 * rendered DOM has the agent-supplied content."
 */
test.describe("Case study slot: design flow", () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseInStorage(page, courseSeedWithCaseStudySlot());
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("module summary renders the slot CTA; design flow fills all four sections", async ({ page }) => {
    await installAgentMock(page, [
      {
        userMessage: /design.*case study/i,
        toolCalls: [
          {
            name: "design_case_study",
            args: {
              case_study_id: CASE_STUDY_ID,
              content: {
                context:
                  "Vantix Pharma is a mid-size specialty pharmaceutical company facing a pivotal pricing decision after Q3 margins compressed.\n\nThis is a fictional scenario constructed for learning purposes, drawing on patterns from Roche oncology pivot 2018.",
                stakeholders: [
                  { name: "Sarah Chen", role: "CEO", voice: "We need to act before the board loses faith in the strategy." },
                  { name: "Marcus Webb", role: "VP Supply Chain", voice: "Switch to mid-tier suppliers and we lose the brand promise." },
                  { name: "Priya Nair", role: "CFO", voice: "Margins recover or we restructure — those are the options." },
                ],
                decisionPoints: [
                  "Maintain the premium and reduce SG&A by 15%?",
                  "Introduce a mid-tier line and accept brand dilution?",
                  "Restructure manufacturing to recover margin?",
                ],
                debriefPrompts: [
                  "Which stakeholder's concern is most likely to be discounted in a fast decision, and why?",
                  "How would your decision change if you learned the CFO had been right about Q3?",
                  "What's the test for whether the mid-tier line would dilute or extend the brand?",
                ],
              },
            },
          },
        ],
        assistantText: "Designed the Vantix Pharma case for Module 1.",
      },
    ]);

    await openCourse(page, COURSE_ID);

    // Open the module summary — click the module number badge in the outline.
    await page.locator('aside button[title="Open module summary"]').click();

    // The empty-slot CTA renders.
    const cta = page.getByRole("button", { name: /design "Vantix Pharma/i });
    await expect(cta).toBeVisible();

    // Click → chat opens with prefill.
    await cta.click();
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 10_000 });
    await expect(composer).toBeEnabled({ timeout: 10_000 });

    const draft = await composer.inputValue();
    expect(draft).toMatch(/design.*case study/i);
    expect(draft).toContain("Vantix Pharma");

    // Submit → mock fires design_case_study.
    await composer.press("Enter");

    // All four content sections should render with the mocked content.
    await expect(page.getByText("Vantix Pharma is a mid-size specialty")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Sarah Chen")).toBeVisible();
    await expect(page.getByText("Marcus Webb")).toBeVisible();
    await expect(page.getByText("Priya Nair")).toBeVisible();
    await expect(page.getByText("Maintain the premium and reduce")).toBeVisible();
    await expect(page.getByText("Which stakeholder's concern is most likely")).toBeVisible();

    // Header gets the "Download .docx" + "Redesign" buttons (#5j).
    await expect(page.getByRole("button", { name: /download \.docx/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /redesign/i })).toBeVisible();
  });
});
