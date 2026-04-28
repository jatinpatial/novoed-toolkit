# BCG U Studio — e2e harness

Playwright-driven full-stack tests. Two suites:

- **mocked** — pure FE tests with the agent's WebSocket intercepted via `page.routeWebSocket`. No backend, no LLM cost. Fast, deterministic. Runs on every push via the husky pre-push hook.
- **smoke** — real LLM through the running agent backend. Slow, costs subscription quota, non-deterministic content. Run manually before milestones.

## Run the mocked suite

```bash
cd app
npm run test:e2e
```

Vite is auto-spun by Playwright (`webServer` in `playwright.config.ts`). No other setup needed. Takes ~2 minutes, runs ~11 tests.

## Run the smoke suite

The agent backend must be running first:

```bash
# In one terminal:
cd agent-backend && python run.py

# In another:
cd app && npm run test:smoke
```

If you forget to start the backend, the suite bails before any LLM calls fire with a friendly message pointing at this same set of commands.

Smoke tests don't pin specific copy or module titles — LLM output drifts. They assert structural presence (proposal card with N modules, lesson body with ≥3 blocks, etc.). If they regress, prompt drift is the most likely cause; check `agent-backend/agent_backend/config.py`.

## Pre-push hook

`git push` runs the mocked suite locally first. If it fails, the push is blocked.

Bypass for emergencies (broken harness, urgent revert, hook itself misbehaving):

```bash
git push --no-verify
```

Note the bypass in the commit message — it shouldn't be the new normal. If `--no-verify` becomes a habit, fix the harness instead.

## Add a new mocked test

Templates worth copying:

- **Wiring** (click X dispatches Y) → `tests/wiring.spec.ts`
- **Content** (rendered DOM reflects mocked agent output) → `tests/content.spec.ts`
- **Loading indicator label** → `tests/loading-label.spec.ts`
- **Drawer / pure-FE state** → `tests/drawer.spec.ts`

Pattern:

1. `seedCourseInStorage(page, …)` in `beforeEach` — inject the localStorage fixture before any navigation.
2. `installAgentMock(page, [scripts])` — script the WS turns the test expects.
3. `openCourse(page, courseId)` — navigate.
4. Drive the UI, assert.
5. `clearStorage(page)` in `afterEach`.

Use the `cannedResponses.ts` helpers for tool payloads when shape matters; inline if not.

## Snapshot regeneration

We don't ship visual snapshots today. If you add a `toMatchSnapshot` assertion, regenerate with:

```bash
cd app
npm run test:e2e -- --update-snapshots
```

Snapshots land under `e2e/.results/` and are gitignored — only commit a snapshot intentionally by moving it into the spec's directory.

## Layout

```
e2e/
  playwright.config.ts          # webServer (vite), projects (mocked / smoke)
  tsconfig.json                 # @app/* path mapping into ../app/src
  fixtures/
    courseSeedBasic.ts          # baseline localStorage course
    seedHelpers.ts              # case-study slot, etc.
  mocks/
    agentMock.ts                # page.routeWebSocket interceptor
    cannedResponses.ts          # canned QuizQuestion / list_structure / …
  utils/
    storage.ts                  # seed / clear / openCourse
    backendHealth.ts            # smoke pre-flight
  tests/                        # mocked suite (no BE)
  smoke/                        # real-LLM suite (BE required)
  .results/                     # gitignored — traces, screenshots, video, HTML report
```
