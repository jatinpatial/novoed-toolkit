import { useState } from "react";
import { BookOpen, Calendar, CheckCircle2, Clock, MessageSquare, Sparkles, Target, X } from "lucide-react";
import type { CourseOutlineProposal, ProposedLesson, ProposedModule } from "./types";

interface Props {
  proposal: CourseOutlineProposal;
  /** Build the course from the (possibly-edited) proposal. */
  onBuild: (edited: CourseOutlineProposal) => void;
  onDiscard: () => void;
  /** AI-1-polish-C bug 9: Refine in chat — dismiss the card and open
      chat with a "Refine the outline: " prefill so the LD can ask the
      agent for structural changes that inline edits can't easily
      handle (merge modules, change duration, swap topic emphasis). */
  onRefine: () => void;
}

/**
 * CourseOutlineProposalCard — what Course Architect drops in front of
 * the LD before the course gets built.
 *
 * AI-1-polish-C: every cell on the card is now click-to-edit. Module
 * title / summary / lesson titles / each learning objective swap
 * to an editable input on click; blur or Enter saves to a local
 * draft. The draft only commits to the actual course when the LD
 * clicks "Build this course" — Discard / Refine in chat both throw
 * the edits away. Same pattern as the quiz cell editor (B3-tune
 * polish).
 *
 * Three-button action row:
 *   Discard           clears the proposal
 *   Refine in chat    clears the proposal + opens chat + prefills
 *                     "Refine the outline: " for the LD to ask for
 *                     structural changes
 *   Build this course commits the local draft to a real course
 */
export function CourseOutlineProposalCard({ proposal, onBuild, onDiscard, onRefine }: Props) {
  // AI-1-polish-C bug 8: local editable copy of the proposal. Initialized
  // from the prop; the prop never re-keys this state because React
  // keeps the same component instance across re-renders. Edits are
  // ephemeral until Build.
  const [draft, setDraft] = useState<CourseOutlineProposal>(proposal);

  const totalLessons = draft.modules.reduce((s, m) => s + m.lessons.length, 0);

  function patchModule(mi: number, fn: (m: ProposedModule) => ProposedModule) {
    setDraft((d) => ({
      ...d,
      modules: d.modules.map((m, i) => (i === mi ? fn(m) : m)),
    }));
  }
  function patchLesson(mi: number, li: number, fn: (l: ProposedLesson) => ProposedLesson) {
    patchModule(mi, (m) => ({
      ...m,
      lessons: m.lessons.map((l, j) => (j === li ? fn(l) : l)),
    }));
  }

  return (
    <div className="card overflow-hidden border-2 border-brand-200">
      <div className="px-6 py-5 bg-gradient-to-br from-brand-50 to-white border-b border-brand-100">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">
              Course Architect — proposed outline
            </div>
            <h2 className="text-xl font-bold text-ink-900 leading-tight mb-1.5">
              <EditableField
                value={draft.title}
                onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
                placeholder="Course title"
                inputClass="text-xl font-bold text-ink-900 leading-tight"
              />
            </h2>
            {draft.audience && (
              <div className="text-sm text-ink-600 mb-2">For: {draft.audience}</div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} className="text-ink-400" />
                {draft.durationWeeks} week{draft.durationWeeks !== 1 ? "s" : ""}
              </span>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={12} className="text-ink-400" />
                {draft.modules.length} module{draft.modules.length !== 1 ? "s" : ""}
              </span>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={12} className="text-ink-400" />
                {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button
            onClick={onDiscard}
            title="Dismiss proposal"
            className="text-ink-400 hover:text-ink-700 hover:bg-white rounded p-1 -mt-1 -mr-1 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
        {draft.modules.map((m, mi) => (
          <div key={m.weekNumber} className="rounded-lg border border-ink-200 bg-white">
            <div className="px-4 py-3 border-b border-ink-100 bg-ink-50/50">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-md bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  W{m.weekNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink-900">
                    <EditableField
                      value={m.title}
                      onChange={(v) => patchModule(mi, (mm) => ({ ...mm, title: v }))}
                      placeholder="Module title"
                      inputClass="text-sm font-bold text-ink-900"
                    />
                  </div>
                  {/* Summary — empty default still shows a placeholder so
                      the LD can click to add one even if Course Architect
                      didn't include one. */}
                  <div className="text-xs text-ink-500 mt-0.5">
                    <EditableTextarea
                      value={m.summary || ""}
                      onChange={(v) => patchModule(mi, (mm) => ({ ...mm, summary: v }))}
                      placeholder="Module summary (optional)"
                      inputClass="text-xs text-ink-500"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3">
              {m.objectives && m.objectives.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-1.5">
                    <Target size={11} />
                    Learning objectives
                  </div>
                  <ul className="space-y-1">
                    {m.objectives.map((obj, oi) => (
                      <li key={oi} className="flex items-start gap-2 text-xs text-ink-700">
                        <CheckCircle2 size={12} className="text-brand-600 flex-shrink-0 mt-0.5" />
                        <span className="flex-1">
                          <EditableField
                            value={obj}
                            onChange={(v) =>
                              patchModule(mi, (mm) => ({
                                ...mm,
                                objectives: (mm.objectives || []).map((o, j) =>
                                  j === oi ? v : o,
                                ),
                              }))
                            }
                            placeholder="Learning objective"
                            inputClass="text-xs text-ink-700"
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-[10px] font-bold text-ink-500 uppercase tracking-wide mb-1.5">
                  Lessons
                </div>
                <div className="space-y-1">
                  {m.lessons.map((l, li) => (
                    <div key={li} className="flex items-baseline gap-2 text-xs text-ink-700">
                      <span className="font-bold text-ink-400 flex-shrink-0">
                        {m.weekNumber}.{li + 1}
                      </span>
                      <span className="flex-1">
                        <EditableField
                          value={stripPrefix(l.title, m.weekNumber, li + 1)}
                          onChange={(v) => patchLesson(mi, li, (ll) => ({ ...ll, title: v }))}
                          placeholder="Lesson title"
                          inputClass="text-xs text-ink-700"
                        />
                      </span>
                      {l.durationMin && (
                        <span className="text-[10px] text-ink-400 flex-shrink-0">
                          {l.durationMin} min
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 border-t border-ink-100 bg-ink-50/30 flex items-center gap-3">
        <div className="text-xs text-ink-500 flex-1">
          Click any cell to edit. <strong className="text-ink-700">Build</strong> commits your edits as a real course; <strong className="text-ink-700">Refine in chat</strong> sends you back to Studio Copilot for structural changes.
        </div>
        <button onClick={onDiscard} className="btn-secondary btn-sm">
          Discard
        </button>
        <button onClick={onRefine} className="btn-secondary btn-sm">
          <MessageSquare size={14} /> Refine in chat
        </button>
        <button onClick={() => onBuild(draft)} className="btn-primary btn-sm">
          <Sparkles size={14} /> Build this course
        </button>
      </div>
    </div>
  );
}

/**
 * EditableField — click-to-edit single-line input.
 *
 * Display state: span with hover-tinted background so the LD knows
 * it's clickable. Click swaps to a styled input that auto-focuses
 * + selects all text. Blur or Enter commits and swaps back.
 *
 * Pattern matches the quiz cell editor from B3-tune polish.
 */
function EditableField({
  value,
  onChange,
  placeholder,
  inputClass,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        className={
          (inputClass ?? "") +
          " w-full bg-white border border-brand-500 outline-none rounded px-1.5 py-0.5 -my-0.5 -mx-1.5"
        }
        placeholder={placeholder}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={
        (inputClass ?? "") +
        " cursor-text hover:bg-brand-50 hover:shadow-[inset_0_-1px_0_0_rgba(0,166,81,0.3)] rounded px-1 -mx-1 transition"
      }
    >
      {value || (
        <em className="text-ink-300 not-italic">{placeholder || "Click to edit"}</em>
      )}
    </span>
  );
}

/**
 * EditableTextarea — same pattern as EditableField but a textarea
 * for multi-line content (module summaries, etc.).
 */
function EditableTextarea({
  value,
  onChange,
  placeholder,
  inputClass,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClass?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={rows}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        className={
          (inputClass ?? "") +
          " w-full bg-white border border-brand-500 outline-none rounded px-1.5 py-0.5 -mx-1.5 resize-none"
        }
        placeholder={placeholder}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={
        (inputClass ?? "") +
        " cursor-text hover:bg-brand-50 hover:shadow-[inset_0_-1px_0_0_rgba(0,166,81,0.3)] rounded px-1 -mx-1 transition inline-block w-full"
      }
    >
      {value || (
        <em className="text-ink-300 not-italic">{placeholder || "Click to edit"}</em>
      )}
    </span>
  );
}

function stripPrefix(title: string, week: number, lessonNum: number): string {
  const re = new RegExp(`^${week}\\.${lessonNum}\\s*`);
  return title.replace(re, "");
}
