import type { MouseEvent } from "react";

/**
 * useTilt — 3D tilt + mouse-follow glow handlers for Sana-modern
 * card surfaces (Phase 2 #2 B2c).
 *
 * Returns two mouse handlers. Spread them onto any card-shaped
 * element you want to feel "alive" under the cursor:
 *
 *     const tilt = useTilt();
 *     <button className="entry-card" {...tilt}>...</button>
 *
 * What the handlers do:
 *
 *   1. `onMouseMove` writes `--mx` and `--my` CSS variables on the
 *      target element as percentages (0% .. 100%) of the cursor
 *      position within the bounding box. CSS rules can read those
 *      vars to position a radial-gradient glow that follows the
 *      cursor — see `.entry-card::before` in src/index.css for
 *      the canonical pattern (also `.card-hoverable::before`).
 *
 *   2. `onMouseMove` also applies an inline
 *      `transform: perspective(1000px) rotateX(...) rotateY(...)`
 *      so the card tilts toward the cursor. Max ±3° on each axis —
 *      subtle enough that text stays readable, present enough that
 *      the card feels alive. The CSS rule `transform-style:
 *      preserve-3d` on the card root is what makes the rotation
 *      register as real depth instead of a flat skew.
 *
 *   3. `onMouseLeave` clears the inline transform and resets
 *      `--mx` / `--my` to 50% (center). Without the reset, the
 *      next hover would start from the previous cursor exit
 *      position, which reads as a snap rather than a fresh enter.
 *
 * The handlers read `e.currentTarget`, so the same handler pair
 * works for any number of card elements — call `useTilt()` once
 * per consumer surface and spread the result on every card.
 *
 * No internal state, no refs. The `use*` name follows the React
 * hook convention even though there's nothing stateful inside, so
 * future revisions (reduced-motion check, per-card disable, etc.)
 * can add hooks without changing the call site.
 *
 * Future planned consumers:
 *   - B5  Components catalog tile previews
 *   - B7  Course Builder cover preview
 * Both will spread the same hook output. To opt out (e.g. on a
 * disabled card where tilt would feel like a misleading
 * affordance), simply don't spread the handlers on that element —
 * see EntryCards.tsx for the disabled-card pattern.
 *
 * @returns A pair of mouse handlers, each typed
 *   `(e: React.MouseEvent<HTMLElement>) => void`:
 *   - **`onMouseMove`** — updates `--mx` / `--my` CSS vars and the
 *     inline `transform` for the 3D tilt. Spread onto the card's
 *     `onMouseMove` prop.
 *   - **`onMouseLeave`** — clears the inline transform and recenters
 *     `--mx` / `--my` to 50%. Spread onto the card's `onMouseLeave`
 *     prop.
 */
export function useTilt() {
  return {
    onMouseMove(e: MouseEvent<HTMLElement>) {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
      // Cursor at center -> 0°; cursor at any edge -> ±3°. rotateX
      // is inverted so the top of the card tilts AWAY from the
      // viewer when the cursor is near the top — the card "leans
      // back" from the cursor, which reads as natural depth.
      const rx = -((y - 50) / 50) * 3;
      const ry =  ((x - 50) / 50) * 3;
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    },
    onMouseLeave(e: MouseEvent<HTMLElement>) {
      const el = e.currentTarget;
      el.style.transform = "";
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
    },
  };
}
