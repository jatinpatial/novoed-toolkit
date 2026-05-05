import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Languages, Loader2, X } from "lucide-react";
import { duplicateProject, saveProject } from "../store/projects";
import { useAgent } from "../agent/AgentContext";

/**
 * Track-ML (Multilingual): Translate Course button + modal.
 *
 * Approach: rather than building a parallel translation pipeline,
 * leverages the existing course-clone + agent-chat. The button:
 *   1. Duplicates the project (deep clone via JSON.parse trick the
 *      projects store already supports)
 *   2. Renames the clone with the target language tag
 *   3. Navigates to the new project
 *   4. Pre-fills the agent chat with a structured translation prompt
 *      and auto-sends, so the agent starts iterating through blocks
 *      via update_block / writeLesson
 *
 * Why this beats a custom pipeline for v1:
 *   - Zero new backend tools required
 *   - The agent's existing prompts already enforce the BCG voice +
 *     editorial standards, so the translated output stays in-style
 *   - Each translated course is a first-class artifact (not a tab
 *     on the original) — LD can edit / export / iterate independently
 *
 * Trade-off: 4-week courses with ~96 blocks take many minutes to
 * translate (one update_block call per block). v2 will introduce a
 * batched translate_course_text tool that returns all translations
 * in one round-trip.
 *
 * Languages: starting with the 6 most common for BCG global. Cultural
 * adaptation toggle defaults OFF — literal translation preserves the
 * source's intent best. Preserve-technical-terms is ON — BCG, NovoEd,
 * SCQA, PESTEL etc. stay in English.
 */

interface TranslateButtonProps {
  projectId: string;
  // Course title used for the rename hint. We DON'T pass the full
  // course object — the clone happens via duplicateProject which
  // pulls fresh state from the projects store.
  courseTitle: string;
}

interface LanguageOption {
  code: string;
  name: string;
  /** Native name surfaced as a hint so the LD recognizes it. */
  native: string;
  /** Suffix appended to the cloned project's name. */
  suffix: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "fr",    name: "French",     native: "Français",       suffix: "(Français)" },
  { code: "es",    name: "Spanish",    native: "Español",        suffix: "(Español)" },
  { code: "de",    name: "German",     native: "Deutsch",        suffix: "(Deutsch)" },
  { code: "pt-BR", name: "Portuguese", native: "Português (BR)", suffix: "(Português)" },
  { code: "ja",    name: "Japanese",   native: "日本語",          suffix: "(日本語)" },
  { code: "zh",    name: "Mandarin",   native: "中文",            suffix: "(中文)" },
];

export function TranslateButton({ projectId, courseTitle }: TranslateButtonProps) {
  const navigate = useNavigate();
  const { sendMessage, setOpen: setChatOpen } = useAgent();

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [adaptCulture, setAdaptCulture] = useState(false);
  const [preserveTerms, setPreserveTerms] = useState(true);
  const [running, setRunning] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC closes when not running
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, running]);

  function buildPrompt(lang: LanguageOption): string {
    const lines: string[] = [];
    lines.push(
      `Translate this entire course into ${lang.name} (${lang.native}). This is a BCG U Studio course — maintain the BCG editorial voice and pedagogical structure.`,
    );
    lines.push("");
    lines.push("INSTRUCTIONS:");
    lines.push(
      "1. Call list_structure first to get every module, lesson, and block ID.",
    );
    lines.push(
      "2. For EACH block, call update_block with the translated content. Translate the block.data fields appropriate for that block type (heading, body, items[], answers[], etc.).",
    );
    lines.push(
      "3. For each lesson, also translate the lesson title via writeLesson if a lesson_title or comparable field is exposed.",
    );
    lines.push(
      "4. Translate module titles and module summaries.",
    );
    lines.push(
      "5. After translating each module, briefly confirm in chat which module you just completed.",
    );
    lines.push("");
    lines.push("VOICE & QUALITY:");
    lines.push(
      `- Use FORMAL register in ${lang.name} — appropriate for senior consulting professionals.`,
    );
    lines.push(
      "- Direct address (the equivalent of \"you\" in the target language) — second-person formal where the language distinguishes (vous in French, usted in Spanish, Sie in German, etc.).",
    );
    lines.push(
      "- Maintain the active-voice, scannable, ~12-16 word sentence rhythm of the original.",
    );
    lines.push(
      "- Keep section/heading hierarchy and markdown formatting intact.",
    );
    if (preserveTerms) {
      lines.push("");
      lines.push("PRESERVE IN ENGLISH (do NOT translate):");
      lines.push(
        "- Brand names: BCG, BCG U, NovoEd, Anthropic, Microsoft, Synthesia, Pexels, Rise.",
      );
      lines.push(
        "- BCG framework names: SCQA, PESTEL, Porter's Five Forces, MECE, 2x2, BCG Matrix.",
      );
      lines.push(
        "- Proper nouns: people names, company names, tool names, product names.",
      );
      lines.push(
        "- Course-internal references: module / lesson / case study labels (e.g. \"Module 1\", \"1.2\") stay in English numerical format.",
      );
    }
    lines.push("");
    if (adaptCulture) {
      lines.push("CULTURAL ADAPTATION:");
      lines.push(
        "- Where examples reference US-specific contexts (companies, regulations, sports analogies), substitute regionally relevant equivalents.",
      );
      lines.push(
        "- Adapt currency / units of measure to the target locale.",
      );
      lines.push(
        "- Soften American directness toward the target culture's professional norms.",
      );
    } else {
      lines.push("CULTURAL ADAPTATION:");
      lines.push(
        "- Translate LITERALLY. Do not substitute examples, change companies referenced, or adapt cultural references — preserve the source's exact case studies and analogies.",
      );
    }
    lines.push("");
    lines.push(
      "Begin with module 1 and work sequentially. Do not stop until the entire course is translated.",
    );
    return lines.join("\n");
  }

  function handleTranslate() {
    if (!picked || running) return;
    const lang = LANGUAGES.find((l) => l.code === picked);
    if (!lang) return;
    setRunning(true);
    try {
      const cloned = duplicateProject(projectId);
      if (!cloned) {
        setRunning(false);
        return;
      }
      // Rename: replace " (copy)" with the language suffix so the LD
      // can tell at-a-glance which language each course is.
      const baseName = courseTitle.replace(/\s*\(copy\)\s*$/i, "").trim();
      saveProject({
        ...cloned,
        name: `${baseName} ${lang.suffix}`,
      });
      // Navigate to the cloned project
      const prompt = buildPrompt(lang);
      navigate(`/courses?project=${cloned.id}`);
      // Open chat + send the translation prompt. Defer the send a
      // tick so the navigation lands and AgentProvider state is
      // attached to the cloned project's context.
      window.setTimeout(() => {
        setChatOpen(true);
        sendMessage(prompt);
        setRunning(false);
        setOpen(false);
      }, 400);
    } catch {
      setRunning(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm"
        title="Translate this course into another language"
      >
        <Languages size={14} /> Translate
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 flex items-center justify-center p-6"
          onClick={() => !running && setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  New
                </div>
                <h3 className="text-lg font-bold text-ink-900">Translate course</h3>
              </div>
              <button
                onClick={() => !running && setOpen(false)}
                disabled={running}
                aria-label="Close"
                className="p-1.5 rounded-md hover:bg-ink-50 text-ink-500 disabled:opacity-30"
              >
                <X size={18} />
              </button>
            </header>
            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs text-ink-500 mb-3 leading-relaxed">
                  Creates a new copy of "{courseTitle}" in the chosen language.
                  The original stays untouched. Translation runs in the chat —
                  it usually takes 2-5 minutes for a typical 4-week course.
                </p>
                <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                  Target language
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      type="button"
                      key={l.code}
                      onClick={() => setPicked(l.code)}
                      disabled={running}
                      className={
                        picked === l.code
                          ? "form-chip form-chip-active text-left"
                          : "form-chip text-left"
                      }
                    >
                      <div className="text-sm font-semibold">{l.name}</div>
                      <div className="text-[10px] opacity-70">{l.native}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-ink-100">
                <label className="flex items-start gap-2.5 cursor-pointer p-2 -mx-2 rounded-md hover:bg-ink-50 transition">
                  <input
                    type="checkbox"
                    checked={preserveTerms}
                    onChange={(e) => setPreserveTerms(e.target.checked)}
                    disabled={running}
                    className="mt-0.5 h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink-900 block">
                      Preserve technical terms in English
                    </span>
                    <span className="text-xs text-ink-500 leading-relaxed">
                      BCG, NovoEd, SCQA, PESTEL, framework names, brand names stay untranslated.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer p-2 -mx-2 rounded-md hover:bg-ink-50 transition">
                  <input
                    type="checkbox"
                    checked={adaptCulture}
                    onChange={(e) => setAdaptCulture(e.target.checked)}
                    disabled={running}
                    className="mt-0.5 h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink-900 block">
                      Adapt examples to local context
                    </span>
                    <span className="text-xs text-ink-500 leading-relaxed">
                      Substitute regional companies, currencies, cultural references. Off = literal translation.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={running}
                className="btn-tertiary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTranslate}
                disabled={!picked || running}
                className="btn-cta-primary btn-sm"
              >
                {running ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Setting up…
                  </>
                ) : (
                  <>
                    <Languages size={14} /> Translate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
