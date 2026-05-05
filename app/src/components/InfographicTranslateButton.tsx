import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Languages, Loader2, X } from "lucide-react";
import { saveInfographic, type Infographic } from "../store/infographics";
import { useAgent } from "../agent/AgentContext";

/**
 * Track-V3 multilingual extension — Translate an Infographic into
 * any of 6 languages. Mirror of the Course-level TranslateButton,
 * but operates on an Infographic record instead of a Project.
 *
 * RTL-aware: Arabic is included with a `rtl: true` flag so the
 * downstream renderer (InfographicRenderer) can flip layout
 * direction. The translated copy is a NEW Infographic record
 * (different id) so the original stays untouched.
 *
 * Why not generalize the existing TranslateButton: courses live in
 * the projects store with project-shaped clone semantics, while
 * infographics live in their own store with a flat record shape.
 * One file each is cleaner than a heavy abstraction across stores.
 */

interface Props {
  infographic: Infographic;
}

interface LanguageOption {
  code: string;
  name: string;
  native: string;
  suffix: string;
  rtl: boolean;
}

const LANGUAGES: LanguageOption[] = [
  { code: "fr",    name: "French",     native: "Français",       suffix: "(Français)",       rtl: false },
  { code: "es",    name: "Spanish",    native: "Español",        suffix: "(Español)",        rtl: false },
  { code: "de",    name: "German",     native: "Deutsch",        suffix: "(Deutsch)",        rtl: false },
  { code: "pt-BR", name: "Portuguese", native: "Português (BR)", suffix: "(Português)",      rtl: false },
  { code: "ja",    name: "Japanese",   native: "日本語",          suffix: "(日本語)",          rtl: false },
  { code: "zh",    name: "Mandarin",   native: "中文",            suffix: "(中文)",            rtl: false },
  // V3: RTL support. Arabic flips the renderer's reading direction
  // via dir="rtl" + adjusts margin/padding asymmetries in CSS.
  { code: "ar",    name: "Arabic",     native: "العربية",        suffix: "(العربية)",         rtl: true  },
];

export function InfographicTranslateButton({ infographic }: Props) {
  const navigate = useNavigate();
  const { sendMessage, setOpen: setChatOpen } = useAgent();

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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
      `Translate this infographic into ${lang.name} (${lang.native}).`,
    );
    lines.push("");
    lines.push("INSTRUCTIONS:");
    lines.push(
      `1. Get the current infographic via list_structure (the active infographic id is the URL :id param).`,
    );
    lines.push(
      `2. Call write_infographic with the SAME id, all fields translated to ${lang.name}: title, subtitle, every point's heading + body. Keep iconHints and the layout style intact (those are visual, not language-bound).`,
    );
    lines.push("");
    lines.push("PRESERVE IN ENGLISH:");
    lines.push(
      "- BCG / NovoEd / brand names, framework names (SCQA, PESTEL, Porter's Five Forces, BCG Matrix, MECE, 7S), proper nouns, company names.",
    );
    if (lang.rtl) {
      lines.push("");
      lines.push("RTL DIRECTION:");
      lines.push(
        "- This is a right-to-left language. Write naturally in Arabic — the renderer auto-flips the layout direction. Do NOT manually reverse word order or insert RTL control characters; standard Arabic text is what we want.",
      );
    }
    lines.push("");
    lines.push("VOICE:");
    lines.push(
      `- Formal/professional ${lang.name}. Senior consulting tone.`,
    );
    lines.push(
      "- Same compactness rules as the source: heading 3-6 words, body 15-30 words.",
    );
    return lines.join("\n");
  }

  function handleTranslate() {
    if (!picked || running) return;
    const lang = LANGUAGES.find((l) => l.code === picked);
    if (!lang) return;
    setRunning(true);
    try {
      // Clone: same content, NEW id, language tag in the title.
      const newId =
        "ig-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      const baseName = infographic.title.replace(/\s*\([^)]+\)\s*$/, "").trim();
      const cloned: Infographic = {
        ...infographic,
        id: newId,
        title: `${baseName} ${lang.suffix}`,
        // V3: language metadata so the renderer knows to dir=rtl
        // when the user opens this infographic. Read in
        // InfographicStudio's render path.
        languageCode: lang.code,
        rtl: lang.rtl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveInfographic(cloned);

      const prompt = buildPrompt(lang);
      navigate(`/infographics/${newId}`);
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
        title="Translate this infographic to another language"
      >
        <Languages size={14} /> Translate
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 flex items-center justify-center p-6"
          onClick={() => !running && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  New
                </div>
                <h3 className="text-lg font-bold text-ink-900">Translate infographic</h3>
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
              <p className="text-xs text-ink-500 leading-relaxed">
                Creates a new copy of this infographic in the chosen language.
                Original stays untouched. Brand names + framework names stay
                in English. Arabic auto-flips to right-to-left layout.
              </p>
              <div>
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
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        {l.name}
                        {l.rtl && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-brand-100 text-brand-700">RTL</span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-70">{l.native}</div>
                    </button>
                  ))}
                </div>
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
