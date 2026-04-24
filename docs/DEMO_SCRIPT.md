# BCG U Studio — 5-minute Demo Script

**Audience:** BCG U leadership · Cross-Practice LDs · IT/Risk reviewers
**Duration:** 5:00 (±15s)
**Recording tools:** OBS / Loom / QuickTime · 1920×1080 · system mic + light screen blur on email/Slack

> **Goal:** Show the end-to-end loop — *brief in chat → full course module ready for the LMS* — in under 5 minutes. Avoid feature dumps. Lead with a believable LD scenario.

---

## Setup checklist (do this before you hit record)

- [ ] Claude Desktop open, fresh chat, sidebar empty
- [ ] BCG U Studio extension already installed (`Settings → Extensions` shows it green)
- [ ] Browser tab open at `http://localhost:7724` showing the Studio Home (clean)
- [ ] One source video on your Desktop named `lecture-raw.mp4` (any 5–10 min recording)
- [ ] Screen at 100% zoom, system notifications muted, dock auto-hidden
- [ ] OBS scene: 100% screen capture · 1920×1080 · 30fps · Mac retina users — set Display Capture to scale 1:1
- [ ] Mic check: `-12dB` peak target

---

## Beat sheet

| Time | What's on screen | What you say |
|------|------------------|--------------|
| **0:00 – 0:25** | BCG U Studio home page | "This is BCG U Studio — an AI Learning Design agent. Today an LD spends most of their time *assembling* — picking templates, themeing them, exporting SCORM, trimming videos. Studio collapses all of that into one chat." |
| **0:25 – 0:35** | Cursor hovers Quick Launch tiles | "31 HTML components, 16 SCORM activities, branded for BCG. But the magic isn't in this UI — it's in the chat." |
| **0:35 – 0:55** | Switch to Claude Desktop, fresh chat | "Watch. I'll ask Claude for a real module — like an LD would brief a freelancer." Type slowly: *"Use the BCG U Studio to draft a 25-min onboarding journey on AI ethics for new analysts. 4 modules, one branching scenario, one knowledge check."* |
| **0:55 – 1:30** | Claude streams response, calls `push_journey` | "Claude calls into the Studio's `push_journey` tool. While that runs — note Claude is choosing components from the catalog, drafting durations, writing learning objectives." |
| **1:30 – 1:50** | Switch back to browser tab — Journey Builder appears with 4 modules | "And there it is. 4 modules, 25 minutes total, learning objectives drafted, components pre-picked. This took **9 seconds**." |
| **1:50 – 2:20** | Click into module 2 — open one of the components | "I can refine anything. Let me open the SWOT — adjust the headers — switch to BCG U brand — instant rebrand." (Click brand picker.) |
| **2:20 – 2:55** | Open Components → SCORM → Branching Scenario | "The interactive activities are SCORM 1.2 zips — they upload to anything: NovoEd, Rise, Docebo, Moodle, Canvas." Click Download. "And — this is unique — once it's deployed in the LMS, the LD can press `Ctrl+Shift+E` *inside* the activity to edit it in place. No re-authoring." |
| **2:55 – 3:25** | Switch back to Claude Desktop, paste new prompt | "Last piece — video. Real recordings are usually too long. Let me ask Claude:" Type: *"Trim 0:30 to 1:15 from `~/Desktop/lecture-raw.mp4` and grab a thumbnail at 0:45."* |
| **3:25 – 3:55** | Claude calls `video_info` → `trim_video` → `extract_thumbnail` | "Claude inspected the file with `video_info`, ran `trim_video` and `extract_thumbnail` — all using local `ffmpeg`. The source never leaves my machine. No upload, no vendor, no DPA." |
| **3:55 – 4:25** | Open output folder, show `lecture-raw-trim.mp4` + `.jpg` | "45-second clip. Hero thumbnail. Ready to drop into the LMS as the module's intro video." |
| **4:25 – 4:50** | Back to Studio Home, scroll to install banner | "How does an LD get this? One file. Drag the `.dxt` onto Claude Desktop's Extensions panel. **Five seconds.** No Node install, no JSON config, no IT ticket." |
| **4:50 – 5:00** | Hold on home screen with email visible | "30-min module, brief to LMS-ready, in about 45 minutes. Down from 8–14 hours. patial.jatin@bcg.com if you want a pilot." |

---

## Variations

**If running long (cut to 4:00):**
- Trim 1:50–2:20 (skip the SWOT brand switch)
- Skip the SCORM download click — just point at the activity card

**If audience is technical (IT/Risk):**
- Pause at 3:25 to call out: "all paths are absolute, all binaries are validated, all execution is via `execFile` with arg arrays — no shell injection vector"
- Mention the `.dxt` is just a signed zip, contents are auditable

**If audience is LD-only:**
- Add 30 seconds at 2:20 demoing the Component Recommender ("Pick by teaching goal")
- Skip the IT/Risk technical aside

---

## Post-recording

- [ ] Trim head & tail in QuickTime (no fade — hard cut feels more tool-demo authentic)
- [ ] Export H.264, 1080p, ~60–80MB target
- [ ] Upload to BCG SharePoint *and* drop a 30-sec teaser GIF in `docs/`
- [ ] Send link to: BCG U leadership distribution + 3–5 friendly LDs for first reactions
- [ ] Track who opens it; book follow-ups within 5 days

---

*Demo script v1 · 2026-04-24 · accompanies `LEADERSHIP_ONE_PAGER.md`*
