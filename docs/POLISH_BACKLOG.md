# Polish Backlog (post-Phase-1)

## Labeling note
Commits tagged `Phase 1 #5a-d` (drawer width toggle, loading indicator,
jump button, pre-flight form) are actually polish work that landed
in-line during Phase 1 #4 — they extend the Synthesia Scriptwriter
experience. The real **Phase 1 #5 — Quiz Builder + Case Study
Designer agents** starts after Phase 1 #4 closes; commits tagged from
that point use the same `Phase 1 #5x` series cleanly because the only
prior #5 work is polish (no planned-feature collision).

## Confirmation patterns
- **Single confirmation dialog component for every destructive Regenerate.**
  Lesson Writer "Regenerate", Scriptwriter "Regenerate", per-question
  Quiz Regenerate, Case Study Regenerate — all of them silently wipe
  the existing target. Build one reusable confirmation dialog that
  fires when the target has been edited since last generation
  (compare a `lastGeneratedAt` timestamp against the latest field
  edit). Keeps the UI quiet on first generation and on no-edit
  re-generation; only interrupts when there's something to lose.

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

## Quiz polish (Phase 2)
- **Per-question inline editing.** Click any MCQ stem, option, or rationale → CellEditor textarea swap. Same pattern as Synthesia script cells in #4g. Removes the "regenerate to fix a typo" anti-pattern.
- **Pre-flight form for Quiz Builder.** Mirror the Synthesia Scriptwriter pre-flight (#5d). Fields: count (3 / 5 / 7 / 10), difficulty (easy / medium / mixed / hard), type (mix / MCQ-only / true-false / random). Defaults: mix, 3 per lesson, 5 per module.
- **True/false question type.** Small data model + prompt extension. MCQ + short-answer + true/false covers ~90% of corporate L&D quizzes without H5P weight.
- **Drag-and-drop, matching, hotspot.** H5P territory — Phase 3 if ever.

## Editability audit (Phase 2)
- Every render-only display in the app should be editable. Audit all components: lesson titles, module titles, knowledge check questions, case study fields. Apply the CellEditor pattern uniformly. The current "regenerate to fix one word" friction is the symptom; this audit is the root cause.

## Case study discoverability v2 (Phase 2)
- Beyond the outline badge (#5i), consider a "Case studies" tab in the left sidebar alongside Outline / Materials. Lists every case study in the course with status (planted / designed). Click → jumps to the module summary page.

## Citations system (Phase 2 — bigger feature)
- When Lesson Writer / Case Study Designer / Quiz Builder use Materials shelf content, automatically track which sources informed which generated content.
- Surface as footnotes in lesson body / case study text / quiz rationales.
- Include in all .docx exports.
- Requires:
  - source-tracking field on Block / Quiz / CaseStudy types
  - prompt updates across all writer modes (emit citation markers inline)
  - footnote rendering UI on every surface that displays generated content
  - footnote support in the .docx export pipeline
- The Sources / Inspired by block in the Case Study Designer (#5j) is a one-section ad-hoc ancestor of this; the full system unifies the pattern across every mode.

## Preview feature broken (existing bug, predates Phase 1 #5)
- The "Preview" button at the top right of CourseStudio doesn't render the lesson correctly. Investigate as a separate ticket — broken before Phase 1 #5, not caused by it.

## Phase 2 — Scriptwriter polish
- **Parameter wizard modal at script start.** Replace today's single chat pre-fill with a structured intake the LD fills before the agent runs:
  - **Duration** — preset (60 / 90 / 120 / 180 sec) or custom.
  - **Tone** — conversational / narrative / authoritative.
  - **Pacing** — slow / standard / fast (maps to wpm: 130 / 150 / 170).
  - **Anchor** — lesson body / materials / scratch (forces the source the agent draws from instead of letting it choose).
  Today the agent makes these choices implicitly from the prompt; surfacing them gives the LD a steering wheel without writing a paragraph of intent each time. Wizard submits the structured params alongside the prefilled message text.

## Deck-drop entry flow (Phase 2 follow-up)
The "Drop a deck" card on the Dashboard currently renders disabled
("soon" badge). The materials-shelf infrastructure exists from Phase
1 #3 (`/parse` endpoint, `read_materials` tool, `Course.materials`
field), but the drop-zone-to-course wiring opens enough scope to
deserve its own commit:

- **Pre-course materials home.** A dropped deck has no course yet to
  attach to. Stash the parsed text in localStorage as a "pending
  materials" slot keyed by a fresh course-id stub, then attach during
  the buildCourseFromProposal step.
- **Agent-aware build.** Course Architect today proposes a course from
  scratch; needs to know "draw structure from these materials" when
  the pending-materials stash is non-empty. Prompt update + a flag
  passed through the propose_course_outline call.
- **Parse error states.** `/parse` returns 415 (unsupported type) and
  413 (file too large); the drop card needs in-line error messaging
  matched to the existing MaterialsShelf toasts.
- **Multi-file handling.** Decision: single file at a time for v1, or
  multi-drop with sequential parse + concat? Single is cheaper.
- **Drop-zone UX.** Visual feedback during drag-over, parse-in-flight,
  parse-complete-but-pre-navigate states. ~50 lines.

When all four pieces land, the card flips from disabled to active
and the "Coming in Phase 3" badge comes off. ~150-200 lines total
across one or two commits.

## Brand fonts in .docx exports (Phase 2)
- Henderson Sans is BCG's official font for documents.
- Currently defaulting to Trebuchet MS as a Windows-built-in fallback (set via `_set_docx_default_font` in `agent-backend/agent_backend/main.py`).
- Phase 2 upgrade path: drop the licensed Henderson Sans `.woff2` files into `agent-backend/fonts/`, swap `_DOCX_FONT = "Trebuchet MS"` → `"Henderson Sans"` in main.py, document the install step in `docs/RUN.md`.

## Repo cleanup (post-pilot)
- Port `index.html` components catalog into `app/src/generators/`, then archive `index.html`.
- Archive `NovoEd_Component_Library.jsx`, `ARCHITECTURE.md`, `NovoEd_Toolkit_Claude_Project_Instructions.md` after extracting any reusable bits.
- Rewrite top-level `README.md` to point at the React + agent-backend architecture.

## Phase 3 — Engaging loading states

Replace the static "Thinking..." indicator with claude.ai-style chat
loading polish. Today the loading orb pulses + the friendly tool label
sits there for the full 30-45 seconds of a typical agent turn —
functional but flat, especially during long lessons + KC writes.

- Cycling status messages with personality (rotate through copy that
  matches the current tool's flavor):
    - Course Architect:    "Considering the angle...", "Sketching the
                            week-by-week...", "Planting case studies..."
    - Lesson Writer:       "Stitching this together...", "Reading
                            between the lines...", "Picking the bolded
                            phrases...", "Almost there..."
    - Quiz Builder:        "Drafting the stems...", "Plausibly wrong
                            answers...", "Writing the rationales..."
    - Case Study Designer: "Casting the stakeholders...", "Setting the
                            decision points...", "Testing the
                            tensions..."
- Animated particle effects in the orb — drifting sparkles within the
  green gradient. Subtle; not distracting; reads as "alive thinking."
- Subtle progress shimmer that stays alive during long turns — the
  current tool indicator pulses but doesn't *progress*; a slow
  shimmer across the indicator bar gives a sense of forward motion.
- Varied "Thinking..." phrasing per turn so consecutive turns don't
  feel repetitive ("Considering...", "Reasoning through this...",
  "Working through it...", etc.).
- Optional: per-tool icon swap on the orb (Sparkles → BookOpen during
  read_materials, Sparkles → Edit3 during write_lesson).

Inspired by claude.ai's loading polish — adds personality to the
30-45 second wait. Reduces perceived wait time by 30-40% per L&D
research (perceived progress matters more than actual progress).
Phase 3 work; not blocking demo-readiness.

## Phase 3 — Image-to-interactive SCORM generation

**The vision:** LD pastes / uploads a static image (PPT export, screenshot,
hand-sketched diagram, existing course materials with static visuals).
The tool analyzes the image, proposes an interaction pattern, lets the
LD refine, and outputs a self-contained interactive component packaged
as SCORM 1.2 / 2004 — uploadable to NovoEd, Rise, Docebo, Moodle,
Canvas, or any SCORM-compatible LMS.

**The pipeline:**

1. **Image input** — drag/drop, paste from clipboard, or pick from
   the materials shelf. PNG / JPEG / SVG / PDF page.
2. **Claude vision analysis** — already available in the agent SDK.
   Identifies regions, extracts text, infers structural pattern
   ("this is a 5-stage process," "this is a 2x2 matrix," "this is a
   stakeholder hierarchy," "this is a stat block").
3. **Interaction proposal** — Claude maps the structural pattern to
   one of ~8-10 curated interaction templates:
   - Process diagram → sequential click-to-reveal with progress bar
   - Comparison matrix → click-to-flip columns or hover-reveal
   - Stakeholder map → hotspot-on-image with floating annotations
   - Concept map → branching reveal with connecting lines
   - Stat block → animated counters on scroll/load
   - Hierarchy → expand/collapse tree
   - Process flow → step-by-step with animated arrows
   - Quadrant chart → click each quadrant for detail
4. **LD refinement editor** — drag hotspots, edit text, swap interaction
   type, adjust colors per brand. Same `--brand-500` token cascade as
   the rest of the app, so brand swap re-themes the interactive.
5. **Generation** — produces a self-contained HTML / CSS / JS bundle.
   No external dependencies; works offline; Webby browser only (no
   Flash, no Java).
6. **SCORM packaging** — wraps as SCORM 1.2 / 2004 with
   `imsmanifest.xml`, launch HTML, completion tracking via the
   SCORM API. We have basics from Phase 1; need to wrap each
   interaction template cleanly.

**Why it's a real moat:**

No competitor in the L&D AI space ships static-image-to-interactive
conversion with SCORM output. Articulate has static image uploads.
Synthesia doesn't do infographics. Genially has interactive
infographics but requires manual building. Sana has rich content
but no static-asset transformation. Coursebox treats images as
static. Visme / Canva are generic design tools, not L&D-specific
and don't produce SCORM. **This is genuinely novel.**

**Use cases for BCG U:**
- LDs already have PowerPoint slides they want to convert
- Genially exports that need updating to a different brand
- Hand-sketched concept diagrams from case team workshops
- Screenshots from client deliverables that need to be teaching artifacts
- Existing course materials with static visuals that should engage

**Effort estimate:** ~3 weeks focused engineering.

| Component | Days |
|---|---|
| Image analysis pipeline (Claude vision + OCR + region detection) | 3-4 |
| Interaction template library (8-10 patterns) | 4-5 |
| LD refinement editor (drag hotspots, edit text, swap type, theme) | 4-5 |
| SCORM 1.2 / 2004 packaging | 2-3 |
| BCG U brand theming via existing `--brand-500` tokens | 2 |
| Polish + cross-LMS compatibility testing | 2-3 |

**Phase 3 timing — not now because:**

- Phase 2 is about making the *core* loop work end-to-end (brief →
  course → publishable artifact). Without that, image-to-interactive
  is a feature on top of an unstable product.
- LDs need to use the tool for real first. Their pilot feedback
  shapes which interaction patterns to prioritize. Building 8
  templates without knowing which ones LDs actually need = wrong
  templates.
- This deserves its own focused 3-week sprint, not piecemeal work.

**Down-payment in Phase 2:** Lesson Writer v2 will have the agent
*propose* interactivity ("here's a flywheel concept with 4
quadrants...") with structured data. Phase 3 graduates this from
"agent suggests an idea" to "agent + LD turns the LD's static
asset into the actual interactive."

**When to start:** After Phase 2 (AI sprint #1, deployment, Living
Courses, multi-artifact, in-flow QA) ships and we have at least
2-4 weeks of pilot LD feedback. Estimated ~6-10 weeks from now.
