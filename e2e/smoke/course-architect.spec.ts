import { test, expect } from "@playwright/test";
import { ensureBackendRunning } from "../utils/backendHealth";

/**
 * Real-LLM smoke: Course Architect proposes an outline from a brief.
 *
 * Pins MODE 1 of the system prompt (config.py) end-to-end:
 *   user brief → assistant text preview → propose_course_outline call
 *   → CourseOutlineProposalCard renders with N modules and a "Build
 *   this course" button.
 *
 * Doesn't assert specific module titles or copy — LLM output varies.
 * Asserts structural presence (multiple modules, build button) so the
 * test isn't flaky on prompt drift.
 *
 * Cost: one Claude turn per run, typically 4-8 tool calls + assistant
 * text. Run sparingly (manual/pre-push, not on every save).
 */
test.describe("Smoke: Course Architect outline proposal", () => {
  test.beforeAll(async () => {
    await ensureBackendRunning();
  });

  // Real LLM turns can take 30-90s; bump the per-test timeout.
  test.setTimeout(180_000);

  test("4-week change-management brief produces a proposal with 4 modules", async ({ page }) => {
    await page.goto("courses");

    // Open the floating Copilot. The empty-state and floating both
    // have "Copilot" in their accessible name; pick the floating one
    // via its exact button label.
    await page.getByRole("button", { name: "Copilot", exact: true }).click();
    const composer = page.locator('textarea[placeholder="Message the copilot…"]');
    await composer.waitFor({ state: "visible", timeout: 15_000 });
    await expect(composer).toBeEnabled({ timeout: 15_000 });

    // Send a brief that clearly triggers MODE 1 (no existing course,
    // explicit week count + audience).
    await composer.fill(
      "Build me a 4-week course on change management for senior managers leading restructurings.",
    );
    await composer.press("Enter");

    // Outline proposal card should appear. The card's "Build this
    // course" button is the most stable selector — copy on the
    // weekly modules will vary across runs.
    await expect(
      page.getByRole("button", { name: /build this course/i }),
    ).toBeVisible({ timeout: 120_000 });

    // The proposal renders one row per module. Assert at least 3 rows
    // (allows for some flex if the agent shortens to 3 weeks despite
    // the brief). Selector pins the proposal card subtree.
    const proposalCard = page.locator('section, article, div').filter({
      has: page.getByRole("button", { name: /build this course/i }),
    }).first();
    const moduleHeadings = proposalCard.getByText(/^Module\s+\d/i);
    expect(await moduleHeadings.count()).toBeGreaterThanOrEqual(3);
  });
});
