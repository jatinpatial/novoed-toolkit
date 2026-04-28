/**
 * Pre-flight check for smoke tests.
 *
 * Smoke tests hit the real Anthropic API via the running agent
 * backend. If someone forgot to start uvicorn, the symptom is a WS
 * connection refused → useAgentSocket retries every 2s → tests time
 * out after 30+ seconds with a confusing message.
 *
 * This helper checks GET /health BEFORE any test runs and throws a
 * clear error if the backend isn't reachable. Saves the "why is
 * smoke failing?" debugging cycle.
 */

const BACKEND_HEALTH_URL = "http://127.0.0.1:8766/health";

const FRIENDLY_ERROR = `
═════════════════════════════════════════════════════════════════
  Smoke tests need the agent backend running.

  Start it:
    cd agent-backend && python run.py

  Then re-run:
    npm run test:smoke
═════════════════════════════════════════════════════════════════`;

export async function ensureBackendRunning(): Promise<void> {
  try {
    const res = await fetch(BACKEND_HEALTH_URL, { method: "GET" });
    if (!res.ok) throw new Error(`/health returned ${res.status}`);
    const body = await res.json();
    if (!body.ok) throw new Error("/health returned ok=false");
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${FRIENDLY_ERROR}\n\nUnderlying error: ${reason}`);
  }
}
