# Polish Backlog (post-Phase-1)

## Speed / perceived speed
- **Streaming write** — generate blocks one at a time so the LD sees progress, not a 20s blank wait. Biggest perceived-speed win. (~70% of the felt improvement.)
- **Prompt caching** — Anthropic prompt caching for system prompt + course state. ~50% reduction in per-call setup cost.
- **Parallel tool calls** — `list_structure` + `read_materials` should run concurrently, not sequentially.
- **Smaller model for lookups** — Haiku for structure queries, keep Sonnet for actual writing.

## Block variety (Lesson Writer v2)
- Writer currently outputs only Text blocks (B3 design call). Should mix in Callouts, Card Grids, Accordions, Banners, Stats blocks where appropriate.
- Need decision logic: "use callout for key insights, card grid for examples/comparisons, accordion for FAQ-style content."
- Could be Writer prompt v2 or a separate "Block Picker" sub-agent.
- **Video blocks are off-limits to Lesson Writer.** Scripts are owned by the Synthesia Scriptwriter agent (Phase 1 #4) and live in a per-block drawer, not in the lesson body. Lesson Writer v2 may suggest *where* video blocks belong and add empty ones, but it must not write text content into a video block — the Scriptwriter writes the script in its own pass.

## Rendering quality
- Text block should render markdown (bold, italic, lists, basic headings) — even with B3 prompt, agents may emit markdown.
- Or add a Heading block type for section labels.

## UX polish
- Materials shelf: display word count alongside char count (chars stay for the 50K threshold logic).
- `CourseOutlineProposalCard`: empty-state guard for `proposal.modules.length === 0`.
- Tool failure visibility: `write_lesson` should return an error when lesson resolution fails instead of silent-success.
- "Regenerate lesson" button: confirmation prompt before wiping existing blocks.

## Repo cleanup (post-pilot)
- Port `index.html` components catalog into `app/src/generators/`, then archive `index.html`.
- Archive `NovoEd_Component_Library.jsx`, `ARCHITECTURE.md`, `NovoEd_Toolkit_Claude_Project_Instructions.md` after extracting any reusable bits.
- Rewrite top-level `README.md` to point at the React + agent-backend architecture.
