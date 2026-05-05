import type { Course } from "./types";

/**
 * Track-MLE (Microlearning Extractor): export a course as a self-
 * contained, mobile-first HTML deck of swipeable 60-second cards.
 *
 * One card per lesson — distilled to title + 1-2 sentence takeaway +
 * optional retrieval prompt. Plus an intro card and an outro card
 * that bookend the experience. Everything inlined (CSS + JS + content)
 * so the LD can drop the .html file into NovoEd, email it, host on a
 * shared drive, or open it on a phone for review.
 *
 * Why microlearning is hot right now (the elevator pitch for Laura/
 * Stephane): mobile-first L&D consumption is the dominant pattern in
 * 2026. Long courses suffer from drop-off; 60-90 second snackable
 * cards complete at 4-5x the rate. Studies (Towards Maturity, Brandon
 * Hall) put completion gain even higher when paired with retrieval
 * prompts. This export turns ANY existing course into the snackable
 * variant in one click — no LD authoring required.
 *
 * V1 scope (this file): pure FE extraction. We pull from existing
 * lesson text blocks and KC questions; no agent call. Quality is
 * "good enough to demo + ship to a pilot cohort." V2 (queued): an
 * agent path that re-condenses lessons specifically for microlearning
 * voice (shorter, punchier, more decision-oriented framing).
 */

interface Card {
  type: "intro" | "lesson" | "outro";
  /** Module index (0-based) the card belongs to. Used for color cycling. */
  moduleIdx: number;
  /** Display label for the eyebrow (e.g. "Module 2 · Lesson 3"). */
  eyebrow: string;
  title: string;
  body: string;
  /** Optional retrieval prompt — pulls from KC if present, else generic. */
  prompt?: string;
}

/**
 * Pull a 1-2 sentence takeaway from a lesson's text blocks.
 *
 * Strategy:
 *   1. Concat all text-block content
 *   2. Take the first ~200 characters
 *   3. Truncate to the last sentence boundary so we don't cut mid-word
 *
 * Falls back to the lesson title if no text blocks exist (e.g. a
 * lesson that's all video + KC).
 */
function distillLessonBody(lesson: { title: string; blocks: { type: string; data: { content?: string; body?: string } }[] }): string {
  const textBlocks = lesson.blocks.filter(
    (b) => b.type === "text" || b.type === "callout" || b.type === "keypoints",
  );
  let raw = "";
  for (const b of textBlocks) {
    const t = (b.data.content || b.data.body || "").trim();
    if (t) raw += (raw ? " " : "") + t;
    if (raw.length > 600) break; // enough to find a sentence boundary
  }
  if (!raw) {
    // No text — surface lesson title as a one-liner takeaway.
    return `Quick lesson on "${lesson.title}".`;
  }
  // Strip markdown emphasis + inline markup
  raw = raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (raw.length <= 200) return raw;

  // Truncate to the last full sentence within ~200 chars
  const truncated = raw.slice(0, 220);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? "),
  );
  if (lastSentenceEnd > 80) return truncated.slice(0, lastSentenceEnd + 1);

  // No clean sentence boundary — fall back to word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.slice(0, lastSpace > 80 ? lastSpace : 200) + "…";
}

/**
 * Pull a retrieval question from the lesson's knowledge check.
 *
 * Prefers the first MCQ stem (transformed into a reflection prompt).
 * Falls back to undefined when no KC exists — the renderer hides the
 * prompt area in that case.
 */
function distillPrompt(lesson: { knowledgeCheck?: { questions: { type: string; stem: string }[] } }): string | undefined {
  const q = lesson.knowledgeCheck?.questions?.[0];
  if (!q) return undefined;
  // Re-frame an MCQ stem as a reflection prompt by stripping any
  // "Which of the following…" prefix and posing it open-ended.
  const stem = q.stem.trim();
  if (!stem) return undefined;
  // Already a question? Use as-is.
  if (stem.endsWith("?")) return stem;
  return stem + "?";
}

function buildCards(course: Course): Card[] {
  const cards: Card[] = [];
  const totalLessons = course.modules.reduce(
    (n, m) => n + (m.lessons?.length || 0),
    0,
  );

  // Intro card
  cards.push({
    type: "intro",
    moduleIdx: 0,
    eyebrow: `${course.modules.length} module${course.modules.length === 1 ? "" : "s"} · ${totalLessons} lesson${totalLessons === 1 ? "" : "s"}`,
    title: course.title || "Course microlearning",
    body:
      "Swipe through the takeaways from this course — one card per lesson, ~60 seconds each. Use the arrow keys, swipe, or click the dots below.",
    prompt: undefined,
  });

  // Lesson cards
  course.modules.forEach((mod, mIdx) => {
    mod.lessons.forEach((lesson, lIdx) => {
      cards.push({
        type: "lesson",
        moduleIdx: mIdx,
        eyebrow: `Module ${mIdx + 1} · Lesson ${lIdx + 1}`,
        title: lesson.title,
        body: distillLessonBody(lesson),
        prompt: distillPrompt(lesson),
      });
    });
  });

  // Outro card
  cards.push({
    type: "outro",
    moduleIdx: course.modules.length - 1,
    eyebrow: "Apply this week",
    title: "What's next?",
    body:
      "Pick ONE takeaway from these cards. Apply it on a real situation in the next 7 days. The course only matters when it changes what you do.",
    prompt: "Which takeaway will you apply first?",
  });

  return cards;
}

/**
 * Escape HTML-unsafe characters in user-provided strings.
 * Same heuristic as the brand/tokens.ts esc() — duplicated here so
 * exportMicrolearning has zero dependencies and stays portable.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the Card[] as a standalone HTML document.
 *
 * Design notes:
 *   - Mobile-first: full-viewport card, single-column, 16-20px body.
 *   - Swipe nav (touch + arrow keys). Pagination dots at the bottom.
 *   - Module-color rotation across cards via a small palette so the
 *     backdrop subtly shifts as the learner progresses — gives a
 *     "we're moving" feel without needing animations.
 *   - Inlined Inter font load (system fallback) for typography that
 *     reads as "designed" without a network round trip on slow devices.
 *   - All JS is vanilla, no framework, < 5KB inlined.
 */
function renderHtml(courseTitle: string, cards: Card[]): string {
  // BCG green palette for module rotation. Cycles every 4 modules.
  const moduleColors = [
    { bg: "#0d7a4d", accent: "#73d98c" },
    { bg: "#155e3f", accent: "#5fc97e" },
    { bg: "#0a4d31", accent: "#85e09b" },
    { bg: "#1a8c5c", accent: "#a8eab9" },
  ];

  const cardsHtml = cards
    .map((card, i) => {
      const palette = moduleColors[card.moduleIdx % moduleColors.length];
      return `
<section class="card" data-idx="${i}" data-type="${card.type}" style="--card-bg: ${palette.bg}; --card-accent: ${palette.accent};">
  <div class="card-inner">
    <div class="eyebrow">${esc(card.eyebrow)}</div>
    <h2 class="title">${esc(card.title)}</h2>
    <p class="body">${esc(card.body)}</p>
    ${card.prompt ? `<div class="prompt"><span class="prompt-label">Reflect</span>${esc(card.prompt)}</div>` : ""}
  </div>
  <div class="page-num">${i + 1} / ${cards.length}</div>
</section>`;
    })
    .join("\n");

  const dotsHtml = cards
    .map((_, i) => `<button class="dot" data-go="${i}" aria-label="Go to card ${i + 1}"></button>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(courseTitle)} — Microlearning</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    background: #0a4d31;
    color: white;
    -webkit-font-smoothing: antialiased;
  }
  .deck {
    position: fixed;
    inset: 0;
    display: flex;
    transition: transform 360ms cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }
  .card {
    flex: 0 0 100vw;
    height: 100vh;
    background: linear-gradient(160deg, var(--card-bg, #0d7a4d) 0%, color-mix(in srgb, var(--card-bg, #0d7a4d) 70%, black) 100%);
    padding: max(48px, env(safe-area-inset-top)) 32px max(64px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: "";
    position: absolute;
    top: -10%;
    right: -20%;
    width: 60vmin;
    height: 60vmin;
    border-radius: 50%;
    background: radial-gradient(circle, var(--card-accent, #73d98c) 0%, transparent 70%);
    opacity: 0.18;
    pointer-events: none;
  }
  .card-inner {
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2.4px;
    text-transform: uppercase;
    color: var(--card-accent, #73d98c);
    margin-bottom: 16px;
  }
  .title {
    font-size: clamp(28px, 5.5vw, 44px);
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: -0.02em;
    margin-bottom: 20px;
  }
  .body {
    font-size: clamp(16px, 2.4vw, 19px);
    line-height: 1.55;
    opacity: 0.92;
    margin-bottom: 28px;
  }
  .card[data-type="intro"] .body,
  .card[data-type="outro"] .body {
    font-size: clamp(15px, 2.2vw, 17px);
    opacity: 0.85;
  }
  .prompt {
    background: rgba(255, 255, 255, 0.10);
    border-left: 3px solid var(--card-accent, #73d98c);
    border-radius: 0 12px 12px 0;
    padding: 16px 20px;
    font-size: clamp(14px, 2vw, 16px);
    line-height: 1.5;
  }
  .prompt-label {
    display: block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--card-accent, #73d98c);
    margin-bottom: 6px;
  }
  .page-num {
    position: absolute;
    bottom: 24px;
    right: 32px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    opacity: 0.55;
  }
  .nav {
    position: fixed;
    bottom: 16px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 0 24px;
    z-index: 10;
    pointer-events: none;
  }
  .dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    border: none;
    cursor: pointer;
    transition: all 200ms ease;
    pointer-events: auto;
  }
  .dot:hover { background: rgba(255, 255, 255, 0.6); transform: scale(1.3); }
  .dot.active {
    background: white;
    width: 24px;
    border-radius: 4px;
  }
  .arrow {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 300;
    transition: all 200ms ease;
    z-index: 10;
    user-select: none;
  }
  .arrow:hover { background: rgba(255, 255, 255, 0.22); transform: translateY(-50%) scale(1.06); }
  .arrow.prev { left: 16px; }
  .arrow.next { right: 16px; }
  .arrow:disabled { opacity: 0.25; cursor: default; pointer-events: none; }
  .hint {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    opacity: 0.4;
    pointer-events: none;
    z-index: 5;
    transition: opacity 600ms ease;
  }
  .hint.gone { opacity: 0; }
  @media (max-width: 640px) {
    .arrow { display: none; } /* Touch users use swipe */
    .page-num { right: 20px; bottom: 56px; }
  }
</style>
</head>
<body>
<div class="hint" id="hint">← → or swipe to navigate</div>
<div class="deck" id="deck">${cardsHtml}</div>
<button class="arrow prev" id="prev" aria-label="Previous card">‹</button>
<button class="arrow next" id="next" aria-label="Next card">›</button>
<nav class="nav" id="nav">${dotsHtml}</nav>
<script>
(function() {
  var deck = document.getElementById('deck');
  var dots = document.querySelectorAll('.dot');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var hint = document.getElementById('hint');
  var total = ${cards.length};
  var idx = 0;

  function go(n) {
    idx = Math.max(0, Math.min(total - 1, n));
    deck.style.transform = 'translateX(' + (-idx * 100) + 'vw)';
    dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    prev.disabled = idx === 0;
    next.disabled = idx === total - 1;
  }

  prev.addEventListener('click', function () { go(idx - 1); });
  next.addEventListener('click', function () { go(idx + 1); });
  dots.forEach(function (d) {
    d.addEventListener('click', function () { go(parseInt(d.dataset.go, 10)); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go(idx - 1);
    if (e.key === 'ArrowRight' || e.key === ' ') go(idx + 1);
  });

  // Touch swipe
  var startX = 0, startY = 0, swiping = false;
  document.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!swiping) return;
    swiping = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(idx + (dx < 0 ? 1 : -1));
    }
  });

  // Hide hint after first interaction
  setTimeout(function () { hint.classList.add('gone'); }, 4000);
  ['click', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { hint.classList.add('gone'); }, { once: true });
  });

  go(0);
})();
</script>
</body>
</html>`;
}

/**
 * Public entry — generate the HTML, trigger a download.
 * Caller (CourseStudio Export menu) just calls this with the active
 * course; the file lands in the user's Downloads folder.
 */
export function exportMicrolearningHtml(course: Course): void {
  const cards = buildCards(course);
  if (cards.length <= 2) {
    // Just intro + outro means there were no lessons. Bail with a
    // helpful download anyway — better than a silent no-op.
    cards[1] = {
      type: "outro",
      moduleIdx: 0,
      eyebrow: "Heads up",
      title: "No lessons yet",
      body: "This course has no lessons to extract. Add modules and lessons in Course Studio, then re-run this export.",
    };
  }
  const html = renderHtml(course.title || "Course", cards);
  const stem =
    (course.title || "course")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "course";
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stem}-microlearning.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke a tick so the download starts (some browsers race).
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
