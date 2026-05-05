// build-lotties.mjs
//
// Generates hand-crafted modern Lottie JSONs for BCG U Studio.
// Replaces the dud xvrh/lottie-flutter sample assets (off-brand,
// dated, sometimes 2 fps) with on-brand BCG-green animations.
//
// Two animations:
//   - neural-pulse.json    replaces brain.json (splash, mesh hero, build band, course hero)
//   - shimmer-loading.json replaces glow-loading.json (mesh hero BL)
//
// Run with:  node tools/build-lotties.mjs
//
// Output goes to: app/public/animations/
//
// ⚠ KEYFRAME RULE: lottie-web silently freezes the animation at frame 0
// if any layer has non-monotonic timestamps. EVERY t-value in a keyframe
// array must be strictly greater than the previous t. The first version
// of this generator used `(lag + 30) % TOTAL` to wrap timestamps; that
// produced backward-time keyframes for nodes with high lags, which is
// why the constellation rendered but never animated. Fixed in v2 by
// constraining all lags so `lag + pulse_duration <= TOTAL`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "app", "public", "animations");

// BCG palette (RGBA in Lottie's 0..1 floats)
const GREEN = [0.16, 0.73, 0.45, 1];      // #29ba73
const TEAL = [0.16, 0.85, 0.81, 1];       // #2ad9cf

// Ease bezier — two-element arrays so 2D vector values (scale, position)
// validate cleanly. lottie-web is lenient about scalar/vector mismatch
// but it costs nothing to be explicit.
const EASE_2D = { i: { x: [0.42, 0.42], y: [1, 1] }, o: { x: [0.58, 0.58], y: [0, 0] } };
const EASE_1D = { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } };

// ─── Helpers ──────────────────────────────────────────────────────────────

function staticVal(value) {
  return { a: 0, k: value };
}

/**
 * Build animated value with strictly monotonic timestamps.
 * Each keyframe is [t, s] tuple where t is frame number.
 * Tangents auto-applied between adjacent keyframes.
 *
 * @param keyframes  array of {t, s}
 * @param dim        1 for scalar (opacity), 2 for vector (scale/position)
 */
function animatedVal(keyframes, dim = 1) {
  // Validate monotonic
  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].t <= keyframes[i - 1].t) {
      throw new Error(
        `Non-monotonic keyframes: t=${keyframes[i - 1].t} → t=${keyframes[i].t}`
      );
    }
  }
  const ease = dim === 2 ? EASE_2D : EASE_1D;
  const k = keyframes.map((kf, i) => {
    const out = { t: kf.t, s: Array.isArray(kf.s) ? kf.s : [kf.s] };
    if (i < keyframes.length - 1) Object.assign(out, ease);
    return out;
  });
  return { a: 1, k };
}

function transform({ position = [0, 0], scale = 100, opacity = 100, rotation = 0, anchor = [0, 0] } = {}) {
  return {
    o: typeof opacity === "object" ? opacity : staticVal(opacity),
    p: typeof position === "object" && !Array.isArray(position) ? position : staticVal([...position, 0]),
    s: typeof scale === "object" ? scale : staticVal([scale, scale]),
    a: staticVal([...anchor, 0]),
    r: typeof rotation === "object" ? rotation : staticVal(rotation),
    sk: staticVal(0),
    sa: staticVal(0),
  };
}

function ellipse(size, color, opacity = 100) {
  return {
    ty: "gr",
    it: [
      { ty: "el", s: staticVal([size, size]), p: staticVal([0, 0]) },
      { ty: "fl", c: staticVal(color), o: staticVal(opacity), r: 1 },
      { ty: "tr", p: staticVal([0, 0]), a: staticVal([0, 0]), s: staticVal([100, 100]), r: staticVal(0), o: staticVal(100) },
    ],
  };
}

function line(p1, p2, color, strokeWidth = 1.5, opacity = 100) {
  return {
    ty: "gr",
    it: [
      {
        ty: "sh",
        ks: staticVal({
          i: [[0, 0], [0, 0]],
          o: [[0, 0], [0, 0]],
          v: [p1, p2],
          c: false,
        }),
      },
      { ty: "st", c: staticVal(color), o: staticVal(opacity), w: staticVal(strokeWidth), lc: 2, lj: 2 },
      { ty: "tr", p: staticVal([0, 0]), a: staticVal([0, 0]), s: staticVal([100, 100]), r: staticVal(0), o: staticVal(100) },
    ],
  };
}

// ─── neural-pulse.json ────────────────────────────────────────────────────
//
// Concept: a constellation of pulsing nodes connected by faint lines.
// Each node and edge gets a single pulse per loop, staggered so a wave
// of energy travels through the network. Apple Intelligence / Anthropic /
// Vercel UI motion language — reads as "AI thinking" without literal
// brain iconography.
//
// 600x600 canvas, 240 frames @ 60fps = 4s loop.
// Pulse window: 30 frames (0.5s ramp up + ramp down).
// Stagger: nodes spread across [0, 200], edges across [0, 210].

function buildNeuralPulse() {
  const W = 600, H = 600;
  const TOTAL = 240;
  const PULSE_DUR = 30;

  // 11 nodes in an organic cluster (rough oval)
  const nodes = [
    { p: [300, 180], r: 14 },  // top center
    { p: [220, 240], r: 10 },
    { p: [380, 240], r: 10 },
    { p: [160, 320], r: 12 },
    { p: [300, 300], r: 18 },  // big center node
    { p: [440, 320], r: 12 },
    { p: [200, 400], r: 10 },
    { p: [400, 400], r: 10 },
    { p: [280, 420], r: 8 },
    { p: [320, 420], r: 8 },
    { p: [300, 480], r: 14 },
  ];

  // Stagger lags evenly across [0, TOTAL - PULSE_DUR] = [0, 210]
  // For 11 nodes: lag_i = i * 21 → 0, 21, 42, ..., 210
  const NODE_LAG_STEP = (TOTAL - PULSE_DUR) / (nodes.length - 1);

  // Edges — only between proximal nodes so it reads as a network
  const edges = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5],
    [3, 6], [4, 6], [4, 7], [5, 7], [6, 8], [7, 9],
    [8, 10], [9, 10], [4, 8], [4, 9], [3, 4], [4, 5],
  ];
  const EDGE_LAG_STEP = (TOTAL - PULSE_DUR) / (edges.length - 1);

  const layers = [];
  let idx = 0;

  // Lines (rendered behind nodes since they're added first)
  edges.forEach(([a, b], i) => {
    const lag = Math.round(i * EDGE_LAG_STEP);
    // Opacity: 30 (rest) → 80 (peak) → 30 (rest)
    // Build keyframes: t=0 hold, t=lag still at rest, t=lag+15 peak,
    //                  t=lag+30 back to rest, t=TOTAL hold
    const opacityKfs = [];
    if (lag > 0) opacityKfs.push({ t: 0, s: 30 });
    opacityKfs.push({ t: lag === 0 ? 0 : lag, s: 30 });
    opacityKfs.push({ t: lag + Math.floor(PULSE_DUR / 2), s: 80 });
    opacityKfs.push({ t: lag + PULSE_DUR, s: 30 });
    if (lag + PULSE_DUR < TOTAL) opacityKfs.push({ t: TOTAL, s: 30 });

    layers.push({
      ddd: 0,
      ind: ++idx,
      ty: 4,
      nm: `line-${i}`,
      sr: 1,
      ks: transform({ opacity: animatedVal(opacityKfs, 1) }),
      shapes: [line(nodes[a].p, nodes[b].p, TEAL, 1.5, 100)],
      ip: 0,
      op: TOTAL,
      st: 0,
      bm: 0,
    });
  });

  // Nodes on top
  nodes.forEach((n, i) => {
    const lag = Math.round(i * NODE_LAG_STEP);

    // Scale: 80 (rest) → 130 (peak) → 80 (rest)
    const scaleKfs = [];
    if (lag > 0) scaleKfs.push({ t: 0, s: [80, 80] });
    scaleKfs.push({ t: lag === 0 ? 0 : lag, s: [80, 80] });
    scaleKfs.push({ t: lag + Math.floor(PULSE_DUR / 2), s: [130, 130] });
    scaleKfs.push({ t: lag + PULSE_DUR, s: [80, 80] });
    if (lag + PULSE_DUR < TOTAL) scaleKfs.push({ t: TOTAL, s: [80, 80] });

    // Opacity: 50 (rest) → 100 (peak) → 50 (rest)
    const opKfs = [];
    if (lag > 0) opKfs.push({ t: 0, s: 50 });
    opKfs.push({ t: lag === 0 ? 0 : lag, s: 50 });
    opKfs.push({ t: lag + Math.floor(PULSE_DUR / 2), s: 100 });
    opKfs.push({ t: lag + PULSE_DUR, s: 50 });
    if (lag + PULSE_DUR < TOTAL) opKfs.push({ t: TOTAL, s: 50 });

    // Outer halo (transparent green) + inner dot (solid). Center node
    // gets teal inner dot for variety.
    const halo = ellipse(n.r * 2.5, GREEN, 25);
    const dot = ellipse(n.r * 1.6, i === 4 ? TEAL : GREEN, 100);

    layers.push({
      ddd: 0,
      ind: ++idx,
      ty: 4,
      nm: `node-${i}`,
      sr: 1,
      ks: {
        ...transform({ position: n.p }),
        s: animatedVal(scaleKfs, 2),
        o: animatedVal(opKfs, 1),
      },
      shapes: [halo, dot],
      ip: 0,
      op: TOTAL,
      st: 0,
      bm: 0,
    });
  });

  return {
    v: "5.7.0",
    fr: 60,
    ip: 0,
    op: TOTAL,
    w: W,
    h: H,
    nm: "neural-pulse",
    ddd: 0,
    assets: [],
    layers,
    markers: [],
    meta: { g: "BCG U Studio handcrafted v2" },
  };
}

// ─── shimmer-loading.json ─────────────────────────────────────────────────
//
// Concept: a horizontal gradient sweep that travels left-to-right across
// a soft skeleton bar. Modern Vercel/v0 / Linear / Notion AI aesthetic.
// Three pulsing dots above provide cadence indicator.
//
// 400x80 canvas, 90 frames @ 60fps = 1.5s loop.

function buildShimmer() {
  const W = 400;
  const H = 80;
  const TOTAL = 90;

  const layers = [];

  // Background bar (subtle)
  layers.push({
    ddd: 0,
    ind: 1,
    ty: 4,
    nm: "bar-bg",
    sr: 1,
    ks: transform({ position: [W / 2, H / 2], opacity: 100 }),
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "rc", s: staticVal([W - 40, 12]), p: staticVal([0, 0]), r: staticVal(6) },
          { ty: "fl", c: staticVal(GREEN), o: staticVal(15), r: 1 },
          { ty: "tr", p: staticVal([0, 0]), a: staticVal([0, 0]), s: staticVal([100, 100]), r: staticVal(0), o: staticVal(100) },
        ],
      },
    ],
    ip: 0,
    op: TOTAL,
    st: 0,
    bm: 0,
  });

  // Sweeping highlight — a smaller bright bar that travels across
  // Position is animated in 3D (Lottie always uses 3D position) — so
  // dimension is 3, but EASE_2D works since lottie-web pads x/y arrays.
  const sweepKfs = [
    { t: 0,     s: [-100, H / 2, 0] },
    { t: TOTAL, s: [W + 100, H / 2, 0] },
  ];

  layers.push({
    ddd: 0,
    ind: 2,
    ty: 4,
    nm: "sweep",
    sr: 1,
    ks: { ...transform({ opacity: 80 }), p: animatedVal(sweepKfs, 2) },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "rc", s: staticVal([120, 16]), p: staticVal([0, 0]), r: staticVal(8) },
          { ty: "fl", c: staticVal(GREEN), o: staticVal(100), r: 1 },
          { ty: "tr", p: staticVal([0, 0]), a: staticVal([0, 0]), s: staticVal([100, 100]), r: staticVal(0), o: staticVal(100) },
        ],
      },
    ],
    ip: 0,
    op: TOTAL,
    st: 0,
    bm: 0,
  });

  // Three pulsing dots above the bar — cadence indicator. Each dot
  // pulses ONCE per loop, staggered so they read as a typing rhythm.
  for (let i = 0; i < 3; i++) {
    const lag = i * 20;  // 0, 20, 40 — all within [0, 75] for 15-frame pulse
    const opKfs = [];
    if (lag > 0) opKfs.push({ t: 0, s: 30 });
    opKfs.push({ t: lag === 0 ? 0 : lag, s: 30 });
    opKfs.push({ t: lag + 8, s: 100 });
    opKfs.push({ t: lag + 16, s: 30 });
    opKfs.push({ t: TOTAL, s: 30 });

    layers.push({
      ddd: 0,
      ind: 3 + i,
      ty: 4,
      nm: `dot-${i}`,
      sr: 1,
      ks: transform({ position: [W / 2 - 24 + i * 24, H / 2 - 22], opacity: animatedVal(opKfs, 1) }),
      shapes: [ellipse(8, TEAL, 100)],
      ip: 0,
      op: TOTAL,
      st: 0,
      bm: 0,
    });
  }

  return {
    v: "5.7.0",
    fr: 60,
    ip: 0,
    op: TOTAL,
    w: W,
    h: H,
    nm: "shimmer-loading",
    ddd: 0,
    assets: [],
    layers,
    markers: [],
    meta: { g: "BCG U Studio handcrafted v2" },
  };
}

// ─── Write outputs ────────────────────────────────────────────────────────

function write(name, data) {
  const filePath = path.join(OUT, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data));
  const size = (fs.statSync(filePath).size / 1024).toFixed(1);
  console.log(`✓ ${name}.json — ${size} KB | ${data.layers.length} layers | ${(data.op / data.fr).toFixed(2)}s @ ${data.fr}fps`);
}

write("neural-pulse", buildNeuralPulse());
write("shimmer-loading", buildShimmer());

console.log("\nDone. Reload your dev server to see the new animations.");
