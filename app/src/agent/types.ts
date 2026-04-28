export type ClientMessage =
  | { type: "user_message"; text: string }
  | { type: "tool_result"; id: string; ok: boolean; result?: unknown; error?: string }
  | { type: "cancel" };

export type ServerMessage =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "done"; usage?: Record<string, unknown> | null }
  | { type: "error"; message: string };

export interface ChatEntry {
  id: string;
  role: "user" | "assistant" | "tool" | "error";
  text: string;
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

export interface ProposedLesson {
  title: string;
  durationMin?: number;
  objectives?: string[];
}

export interface ProposedModule {
  weekNumber: number;
  title: string;
  summary?: string;
  objectives?: string[];
  lessons: ProposedLesson[];
  // Title for a case-study slot Course Architect wants this module to
  // anchor on (typically 2-3 modules per course get a slot). Slot is
  // planted empty — Case Study Designer fills the content later.
  caseStudyTitle?: string;
}

export interface CourseOutlineProposal {
  title: string;
  audience?: string;
  durationWeeks: number;
  modules: ProposedModule[];
}
