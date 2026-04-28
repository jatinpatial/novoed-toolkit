import { defineConfig, devices } from "@playwright/test";

/**
 * BCG U Studio e2e harness.
 *
 * Two projects:
 *   - "mocked"  — pure FE tests with WebSocket intercepted via
 *                 page.routeWebSocket. No backend dependency. Fast,
 *                 deterministic. Runs on every push via husky pre-push.
 *   - "smoke"   — real LLM via the running agent backend. Slow, costs
 *                 subscription quota. Run manually before milestones
 *                 or whenever a prompt change needs validation.
 *
 * The webServer config spins up vite (FE) automatically. The Python
 * backend is intentionally NOT auto-spun — venv/auth setup is too
 * fragile to wrap in a child process. Smoke tests pre-flight check
 * the backend via utils/backendHealth.ts and bail early with a
 * friendly error if it isn't running.
 */
export default defineConfig({
  testDir: "./",
  fullyParallel: false, // localStorage-backed fixtures don't isolate well in parallel
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never", outputFolder: ".results/html" }]],
  outputDir: ".results/artifacts",

  use: {
    // Trailing slash matters — vite serves the app under the
    // /novoed-toolkit/ base. Without it, page.goto("courses?…") joins
    // against the parent and lands on /courses?… (404 in vite).
    baseURL: "http://localhost:5173/novoed-toolkit/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "mocked",
      testMatch: /tests\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke",
      testMatch: /smoke\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      // Smoke tests need the BE; the spec files call backendHealth() in
      // beforeAll. If the BE is missing, the suite bails with a clear
      // error before any real LLM calls fire.
    },
  ],

  // Auto-spin vite. Reuses an existing dev server if one's already up
  // on 5173 (typical local-dev pattern).
  webServer: {
    command: "npm run dev",
    cwd: "../app",
    url: "http://localhost:5173/novoed-toolkit/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
