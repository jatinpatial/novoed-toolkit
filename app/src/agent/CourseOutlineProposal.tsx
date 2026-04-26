import { BookOpen, Calendar, CheckCircle2, Clock, Sparkles, Target, X } from "lucide-react";
import type { CourseOutlineProposal } from "./types";

interface Props {
  proposal: CourseOutlineProposal;
  onBuild: () => void;
  onDiscard: () => void;
}

export function CourseOutlineProposalCard({ proposal, onBuild, onDiscard }: Props) {
  const totalLessons = proposal.modules.reduce((s, m) => s + m.lessons.length, 0);

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
            <h2 className="text-xl font-bold text-ink-900 leading-tight mb-1.5">{proposal.title}</h2>
            {proposal.audience && (
              <div className="text-sm text-ink-600 mb-2">For: {proposal.audience}</div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={12} className="text-ink-400" />
                {proposal.durationWeeks} week{proposal.durationWeeks !== 1 ? "s" : ""}
              </span>
              <span className="text-ink-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={12} className="text-ink-400" />
                {proposal.modules.length} module{proposal.modules.length !== 1 ? "s" : ""}
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
        {proposal.modules.map((m) => (
          <div key={m.weekNumber} className="rounded-lg border border-ink-200 bg-white">
            <div className="px-4 py-3 border-b border-ink-100 bg-ink-50/50">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-md bg-ink-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  W{m.weekNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink-900 truncate">{m.title}</div>
                  {m.summary && (
                    <div className="text-xs text-ink-500 mt-0.5">{m.summary}</div>
                  )}
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
                    {m.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-ink-700">
                        <CheckCircle2 size={12} className="text-brand-600 flex-shrink-0 mt-0.5" />
                        <span>{obj}</span>
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
                  {m.lessons.map((l, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs text-ink-700">
                      <span className="font-bold text-ink-400 flex-shrink-0">
                        {m.weekNumber}.{i + 1}
                      </span>
                      <span className="flex-1">{stripPrefix(l.title, m.weekNumber, i + 1)}</span>
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
          Review the outline. Click <strong className="text-ink-700">Build</strong> to create the course, or keep chatting to refine it.
        </div>
        <button onClick={onDiscard} className="btn-secondary btn-sm">
          Discard
        </button>
        <button onClick={onBuild} className="btn-primary btn-sm">
          <Sparkles size={14} /> Build this course
        </button>
      </div>
    </div>
  );
}

function stripPrefix(title: string, week: number, lessonNum: number): string {
  const re = new RegExp(`^${week}\\.${lessonNum}\\s*`);
  return title.replace(re, "");
}
