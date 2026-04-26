# BCG U Studio — Learning Design Agent

**One-pager for BCG U leadership · v1.8 (Day 7 of 7, MVP + Storyline Generator)**

---

## The problem

Producing a 30-minute course module today takes a Learning Designer **8–14 hours** across three tools:
- A drag-drop authoring tool (Rise / Genially) for layout — but the templates feel generic, brand fidelity is weak, and SCORM activities require a separate vendor.
- A separate vendor or freelancer for interactive SCORM (flip cards, branching scenarios, drag-to-sort) — typical lead time **3–5 days**, $200–$800 per activity.
- A video editor (Premiere / DaVinci) just to trim source recordings and lift hero thumbnails.

**Net effect:** 65–70% of an LD's time goes to assembly, not instructional design.

## The product

**BCG U Studio is the AI co-pilot that collapses that workflow into a single chat.**

A Learning Designer opens Claude Desktop and types:

> *"Turn `~/Desktop/ai-ethics-deck.pptx` into a 30-min new-joiner course. Save the Word file to my Desktop."*

Claude orchestrates **12 toolkit functions** behind the scenes:
1. Reads PPTX/PDF/DOCX/MD locally — speaker notes included, nothing uploaded.
2. Drafts a full storyline (modules, lessons, body text, video scripts, knowledge checks, glossary).
3. Writes the result to a clean default **Word file** (`.docx`) — ready to hand to a Rise/Storyline builder or drop on NovoEd.
4. Pushes the same outline into the Studio's visual Journey canvas if the LD prefers in-app authoring.
5. Renders 31 brand-themed HTML embeds + 16 interactive SCORM activities for the inline pieces.
6. Trims and thumbnails any source video via local `ffmpeg` — no upload.

Output drops as a **course Word file** (cover page → modules → lessons → scripts → Q&A → appendix), plus **paste-ready HTML** for Rise/NovoEd/Docebo/Moodle/Canvas and **SCORM 1.2 zips** for any LMS. Self-editing: press `Ctrl+Shift+E` inside a deployed activity to edit in place and re-download.

## What's shipped (7-day sprint)

| Day | Deliverable |
|-----|-------------|
| 1 | DXT packaging — one-click `.dxt` install for Claude Desktop. No Node, no config, no IT ticket. |
| 2 | Sidebar IA refresh, command palette (⌘K), library category sections + richer cards. |
| 3 | Journey Builder v0 — visual canvas, module cards with type/duration, AI assist panel. |
| 4 | Content Writer + 2 new MCP tools (`suggest_component`, `push_journey`) — Claude pushes outlines straight into the canvas. |
| 5 | Media Studio + 4 ffmpeg MCP tools (`check_ffmpeg`, `video_info`, `trim_video`, `extract_thumbnail`). |
| 6 | Polish pass — Pro Tip banners, keyboard-shortcut footer, sidebar tooltips, leadership materials. |
| 7 | Storyline Generator + 3 MCP tools (`ingest_source`, `draft_storyline`, `assemble_storyline_docx`). PPTX/PDF/DOCX → full course Word file (cover, modules, lessons, scripts, knowledge checks, glossary) — ready to hand to an Articulate Rise/Storyline builder or load straight onto NovoEd. |

## Why this matters for BCG U

**Time-to-launch:** 30-min module from brief to LMS-ready in **~45 minutes**, down from 8–14 hours. **~10x productivity uplift** per LD.

**Brand consistency:** Every component carries the BCG / BCG U palette, Henderson Sans typography, and the BCG icon library (1,069 icons). No more off-palette PowerPoint imports.

**Cross-LMS, no lock-in:** Output works in Rise, NovoEd, Docebo, Moodle, Canvas — anything that accepts HTML or SCORM 1.2.

**Stays on-machine:** All ffmpeg processing is local. No source files leave the LD's laptop. No new vendor onboarding, no DPA, no SOC 2 review.

**Distribution is trivial:** A `.dxt` file emailed to an LD installs in 5 seconds via drag-drop into Claude Desktop. Zero command-line, zero IT.

## What it would take to scale

| Dimension | What's there | What it needs |
|-----------|--------------|---------------|
| **Reach** | One LD on Day 6 | Pilot with 5 LDs in BCG U for 4 weeks; target time-saved per module |
| **Brand fidelity** | BCG, BCG U, Custom themes; Henderson + Trebuchet | LDs to drop the licensed `.woff2` Henderson files into `/fonts/` (out of scope for this sprint) |
| **Component library** | 31 HTML + 16 SCORM | Add 5 LD-requested patterns per quarter (likely accordion-with-quiz, image-hotspot, timeline-with-video) |
| **Quality bar** | Smoke-checks passing; visual polish reviewed | Formal accessibility (WCAG 2.1 AA) audit before broad rollout |
| **Distribution** | `.dxt` is unsigned but installs cleanly | Optional: BCG-issued code-signing cert removes the "unknown publisher" warning at install time |

## The ask

1. **Pilot blessing:** 5 LDs × 4 weeks. We measure modules shipped per week and time-per-module against the prior 6 months.
2. **Henderson font files:** Approval to ship the licensed `.woff2` files inside the `.dxt` (or a SharePoint-hosted alternative).
3. **A name for the Q3 broader rollout** — current internal name is *BCG U Studio*; rename if BCG U brand strategy prefers something else.

---

*Demo: 5-min screen recording — see `docs/DEMO_SCRIPT.md` · Repo: github.com/Patial-Jatin_bcgprod/novoed-toolkit · Contact: patial.jatin@bcg.com*
