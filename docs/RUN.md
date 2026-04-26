# Running BCG U Studio locally

Two terminals, two commands. Run `scripts/smoke.py` if anything looks off.

## Prerequisites (one-time)

1. **Node 18+** and **Python 3.11+** installed.
2. **Claude Code CLI** installed and logged in:
   ```
   npm install -g @anthropic-ai/claude-code
   claude login
   ```
   The agent backend authenticates through your Claude subscription via
   this CLI. No API key.
3. **Backend deps:**
   ```
   cd agent-backend
   python -m venv .venv
   .venv\Scripts\activate         # Windows
   source .venv/bin/activate      # macOS/Linux
   pip install -e .
   ```
4. **Frontend deps:**
   ```
   cd app
   npm install
   ```

## Required environment variables

Copy `agent-backend/.env.example` to `agent-backend/.env` and fill in:

| Var | Required | Default | What it is |
|---|---|---|---|
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows only | — | Absolute path to Git Bash `bash.exe` (e.g. `C:\Program Files\Git\bin\bash.exe`). The Claude Agent SDK shells out through it. |
| `ALLOWED_ORIGIN` | no | `http://localhost:5173` | Vite dev origin allowed through CORS. Only change if Vite runs on a non-default port. |

`.env` is gitignored. `.env.example` is checked in as the template.

## Run (two terminals)

**Terminal 1 — backend (FastAPI on :8766):**
```
cd agent-backend
python run.py
```

**Terminal 2 — frontend (Vite on :5173):**
```
cd app
npm run dev
```

Open http://localhost:5173 and navigate to the Course Studio. The
`AgentChat` status indicator should reach **connected** within ~1
second.

## Smoke test

With both terminals stopped, from the repo root:

```
python scripts/smoke.py
```

Boots the backend on :8766, checks `/health`, opens a WebSocket to
`/ws`, closes, exits 0 if the handshake completed. It does **not** talk
to Claude — it only proves the wiring is good (FastAPI up, CORS,
WS upgrade).

If it fails, run `cd agent-backend && python run.py` directly to see the
uvicorn logs.

For a deeper LLM round-trip check (requires `claude` CLI logged in), use
`agent-backend/scripts/ws_smoke.py`.
