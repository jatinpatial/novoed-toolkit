import { test, expect } from "@playwright/test";
import { ensureBackendRunning } from "../utils/backendHealth";

/**
 * Smoke: /export/course-docx returns a valid .docx.
 *
 * Pure HTTP exercise — no LLM, no WS, no UI. Hits the real
 * endpoint with a small representative course payload and
 * asserts the response is a real Office Open XML file.
 *
 * Cheaper than the LLM smokes (no Anthropic call), but still
 * lives in the smoke project because it requires the BE running
 * — exactly what /health pre-flights.
 */
test.describe("Smoke: course-docx endpoint", () => {
  test.beforeAll(async () => {
    await ensureBackendRunning();
  });

  test("POST returns a real .docx with the expected content type", async ({ request }) => {
    const res = await request.post("http://127.0.0.1:8766/export/course-docx", {
      data: {
        course: {
          id: "smoke-course",
          title: "Smoke Test Course",
          client: "",
          brand: "bcgu",
          modules: [
            {
              id: "m1",
              title: "Module 1",
              weekNumber: 1,
              summary: "Foundational module.",
              objectives: ["Identify drivers of change."],
              lessons: [
                {
                  id: "l1",
                  title: "1.1 Why change is hard",
                  duration: 10,
                  blocks: [
                    { id: "b1", type: "text", data: { content: "Change is hard because people are involved." } },
                  ],
                },
              ],
            },
          ],
          materials: [{ id: "mat1", filename: "research.pdf", charCount: 12345 }],
        },
        audience: "Senior managers",
      },
    });

    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("officedocument.wordprocessingml.document");
    expect(res.headers()["content-disposition"]).toMatch(/\.docx/);

    const body = await res.body();
    expect(body.length).toBeGreaterThan(5_000);
    // PK signature — Office Open XML is a zip.
    expect(body[0]).toBe(0x50); // 'P'
    expect(body[1]).toBe(0x4b); // 'K'
  });

  test("POST with no modules returns 400 with a clear error", async ({ request }) => {
    const res = await request.post("http://127.0.0.1:8766/export/course-docx", {
      data: {
        course: { id: "empty", title: "Empty", client: "", brand: "bcgu", modules: [] },
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/no modules/i);
  });
});
