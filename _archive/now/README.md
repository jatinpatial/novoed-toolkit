# Archived files (no longer in the active path)

These files were active during the `index.html` toolkit phase. They are kept
here as historical reference; they are NOT part of the React + agent-backend
architecture going forward. See `docs/HANDOFF.md` for the current architecture.

| File | What it did | Why it's archived |
|---|---|---|
| `build_vanilla.py` | Concatenated core JSX into the single-file `index.html` build | The legacy `index.html` SPA is being phased out in favor of `app/` (React). The build pipeline doesn't apply. |
| `convert-icons.js` | One-shot converter that generated `bcg-icons.js` from BCG DrawingML icon source | Already ran. Output (`bcg-icons.js`) lives at the repo root and is what's actually consumed. |
| `course-builder.html` | Standalone single-file course-builder demo | Superseded by `app/src/pages/CourseBuilder.tsx` and `app/src/pages/CourseStudio.tsx`. |
| `procurement-infographic.html` | One-off demo infographic from before the toolkit existed | Pre-dates everything; not part of the product. |

If you need any of these, they're still in git history, and they're right here.
