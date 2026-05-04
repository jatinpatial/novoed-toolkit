# BCG U Studio — Install Guide for Learning Designers

This is the one-page setup. Most LDs are up and running in 10–15 minutes.

## Step 1 — Get the code (5 min)

You should have received a SharePoint link to a ZIP of the latest BCG U Studio.

1. Download the ZIP.
2. Right-click → **Extract All…**
3. Pick a stable location like `C:\BCG-U-Studio` (avoid Desktop or OneDrive — they sometimes lock files mid-install).

## Step 2 — Install (one click, ~10 min)

Double-click **`install.bat`** in the extracted folder.

The installer walks through four steps:

1. **Python check** — if missing, opens the download page and asks you to install Python, then re-run `install.bat`.
2. **Node.js check** — same flow if missing.
3. **Claude Code CLI** — installs `@anthropic-ai/claude-code` globally via npm. Takes 1–2 minutes.
4. **Project dependencies** — Python packages (~2 min) and Node packages (~3 min).

When it says **"All set. BCG U Studio is ready"**, you're done with setup.

> **If a step fails:** the installer prints the failing command. Try running it manually in a fresh terminal — Windows path quirks sometimes trip up the first batch run. If it still fails, contact patial.jatin@bcg.com with the error message.

## Step 3 — Launch (one click)

Double-click **`launch.bat`** in the same folder.

Two terminal windows open:

- **BCG U Studio - Backend** — FastAPI on port 8766
- **BCG U Studio - Frontend** — Vite dev server on port 5173

Wait ~60 seconds for both to settle. The frontend window prints a `ready in XXX ms` line when it's done.

Open **http://localhost:5173** in Chrome or Edge.

> First launch only: a Claude sign-in window opens automatically. Sign in with the same account you use for `claude.ai`. The Studio runs against your existing Claude subscription — no separate API key.

## Step 4 — Try it

The Studio opens with a 4-second splash, then drops you into the dashboard.

- **Course Studio** — full-course flagship. Drop a deck or PDF, write a brief, get a multi-module course in one click.
- **Script Studio** — Synthesia-ready video scripts.
- **KC Studio** — standalone knowledge checks.
- **Infographic Studio** — visual summaries with 9 layout options.

The dashboard ships with 2–3 sample projects pre-loaded so you can see "what good looks like" before building your own. Open one, edit a block, then start a fresh project.

## Daily use

- Start the Studio: **launch.bat**
- Stop the Studio: **stop.bat** (or just close both terminal windows)

The Studio runs entirely on your laptop — no cloud, no shared workspace. Your courses, scripts, KCs, and infographics live in browser localStorage. Clearing browser data wipes them.

## Troubleshooting quick-list

**"claude command not found"** — Open a new terminal (the PATH var only updates in fresh shells after install). If still failing: `npm install -g @anthropic-ai/claude-code` manually.

**"Backend won't start"** — Check that port 8766 isn't already in use: `netstat -ano | findstr :8766`. Kill the process if needed.

**"Frontend won't connect to backend"** — In the dashboard sidebar, the agent status pill should say **connected**. If it says **disconnected**, check that the backend window shows `Uvicorn running on http://0.0.0.0:8766`.

**"My course is gone after I closed the browser"** — Browser localStorage is per-profile. If you cleared cookies/site data, the courses are gone. Don't run the Studio in incognito mode.

For deeper help see [docs/RUN.md](RUN.md) or contact patial.jatin@bcg.com.
