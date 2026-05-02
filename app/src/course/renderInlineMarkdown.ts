import { esc } from "../brand/tokens";

/**
 * Render text with inline markdown bolding.
 *
 * Order matters: HTML-escape FIRST (to neutralize anything that looks
 * like a tag in the user's prose), THEN substitute `**bold**` for
 * `<strong>...</strong>` so the inserted tags don't get re-escaped.
 *
 * Pattern `\*\*([^*]+?)\*\*`:
 *   - Paired `**` markers
 *   - Non-greedy match so "**a** then **b**" gives two runs, not one
 *     spanning both
 *   - `[^*]+?` (no internal asterisks) prevents weird nesting and
 *     keeps math like "5 ** 3 ** 2" from triggering bizarre captures
 *
 * Italic / underline left out — text is the main consumer and bold
 * is the only inline mark in the BCG U / Rise vocabulary. If
 * italics become needed later, add `_..._` -> `<em>` here.
 *
 * Lives in its own file (polish-6b) so every surface that renders
 * editorial-leaning content shares the SAME parser. Pre-polish-6b
 * this lived in previewBlock.ts; some callers (callout body in the
 * canvas SimpleBlockEditor, accordion item descriptions in the
 * canvas InteractiveAccordion) duplicated it implicitly by NOT
 * calling it at all and showing literal `**` to the LD. Single
 * source of truth eliminates that drift.
 *
 * Output is HTML — caller is responsible for using
 * dangerouslySetInnerHTML or a similar trusted-HTML host.
 */
export function renderInlineMd(text: string): string {
  return esc(text).replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
}
