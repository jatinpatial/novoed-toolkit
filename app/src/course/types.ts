import type { BrandKey } from "../brand/tokens";

export interface BlockItem {
  title: string;
  desc?: string;
  img?: string;
  alt?: string;
}

export interface BlockData {
  content?: string;
  url?: string;
  caption?: string;
  alt?: string;
  title?: string;
  body?: string;
  type?: string;
  items?: BlockItem[];
  // Synthesia script for video blocks. Authored by the Scriptwriter agent
  // and edited by the LD in the block drawer; never rendered in the
  // published lesson.
  //
  // Format: a sequence of scene blocks. Each scene has SPOKEN: (the
  // narration with <break time="X.Xs"/> tags) and VISUAL: (what's on
  // screen). Example:
  //   SCENE 1
  //   SPOKEN: Hello there. <break time="0.5s"/> Today we'll cover…
  //   VISUAL: Lower-third with speaker name and title.
  script?: string;
  // How the avatar speaks the script: "speaker" = on-camera presenter
  // talking head with sparse visuals; "narration" = voice-over driving
  // rich full-screen visuals. Defaults to "speaker" when absent.
  videoType?: "speaker" | "narration";
}

export interface Block {
  id: string;
  type: string;
  data: BlockData;
  source?: "writer";
}

// Quiz / knowledge-check structures, owned by the Quiz Builder agent.
// Lessons may have an optional knowledgeCheck (post-lesson recap quiz);
// modules may have an optional knowledgeCheck (final assessment for the
// week's learning). Distinct from the inline "quiz" block type, which
// is a single-question content quiz authored as part of lesson body.
export interface QuizQuestionMCQ {
  type: "mcq";
  stem: string;
  options: string[];
  correctIndex: number;
  rationale: string;
}

export interface QuizQuestionShort {
  type: "short";
  stem: string;
  expectedAnswerHints: string[];
}

export type QuizQuestion = QuizQuestionMCQ | QuizQuestionShort;

export interface Quiz {
  questions: QuizQuestion[];
}

// Course-level case studies, owned by the Case Study Designer agent.
// Course Architect plants 2-3 empty slots per course (id + title only);
// Case Study Designer fills the rest later when the LD asks. Modules
// reference a slot via Module.caseStudyId.
export interface CaseStudyStakeholder {
  name: string;
  role: string;
  voice: string;
}

export interface CaseStudy {
  id: string;
  title: string;
  context: string;
  stakeholders: CaseStudyStakeholder[];
  decisionPoints: string[];
  debriefPrompts: string[];
}

export interface Lesson {
  id: string;
  title: string;
  duration: number;
  blocks: Block[];
  objectives?: string[];
  // Optional post-lesson knowledge check, written by the Quiz Builder.
  knowledgeCheck?: Quiz;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  weekNumber?: number;
  summary?: string;
  objectives?: string[];
  // Optional module-level final assessment, written by the Quiz Builder.
  knowledgeCheck?: Quiz;
  // Single-ref to a Course.caseStudies entry. Single-ref by design —
  // handles "one case study per module" and "two modules sharing the
  // same case study" without an array.
  caseStudyId?: string;
}

export interface Material {
  id: string;
  filename: string;
  text: string;
  charCount: number;
  addedAt: number;
}

export interface Course {
  id: string;
  title: string;
  client: string;
  brand: BrandKey;
  modules: Module[];
  materials?: Material[];
  // 2-3 case-study slots planted by Course Architect; filled later by
  // Case Study Designer. Empty entries (just id + title) are valid.
  caseStudies?: CaseStudy[];
}

export interface BlockType {
  id: string;
  label: string;
  icon: string;
  col: string;
}
