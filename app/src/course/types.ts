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
  // ── AI-1b additions ─────────────────────────────────────────────────
  // Optional photo background for banner blocks. When set, banner
  // renders as a "statement" with the image as a CSS background plus
  // the existing brand-gradient overlay tinting it. When unset, banner
  // renders gradient-only (legacy behavior unchanged).
  imageUrl?: string;
  // Quote block: the speaker's name + role for the attribution row,
  // and an optional photo URL for the round avatar.
  attribution?: string;
  attributionRole?: string;
  attributionPhotoUrl?: string;
  // Section-header block: name of one of the curated lucide icons
  // (see SECTION_ICON_NAMES in blockTypes.ts). Agents must choose
  // from the curated set — anything else falls back to the default
  // BookOpen icon at render time.
  iconName?: string;
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

/**
 * CourseShape — toggles the LD picks on the structured intake form
 * (CreateCoursePage / polish-3d). Course Architect honors the values
 * when proposing the outline; Lesson Writer honors them when writing
 * each lesson's blocks. Persisted on the Course so the constraints
 * survive across multiple agent turns.
 *
 * Each field has an "auto" sentinel meaning "agent picks the default."
 * Omitted fields also default to auto behavior.
 */
export interface CourseShape {
  /** Number of case-study slots Course Architect should plant.
   *  "auto" = current default behavior (2-3 distributed sensibly). */
  caseStudies?: "auto" | "none" | 1 | 2 | 3;
  /** Where Lesson Writer should insert empty video blocks.
   *  "auto" / "key" = default (only when topic warrants); "every" =
   *  every lesson gets a video block; "none" = no video blocks. */
  videoScripts?: "auto" | "none" | "key" | "every";
  /** Quiz Builder scope — lesson-level KCs, module-level final
   *  assessments, both, or auto (current behavior — both). */
  knowledgeChecks?: "auto" | "lesson" | "module" | "both";
  /** Density of interactive blocks per lesson.
   *  light  = minimize interactives, rely on text + bolding.
   *  mixed  = current default (1-2 interactives per lesson).
   *  heavy  = 2+ interactives per lesson. */
  interactivity?: "light" | "mixed" | "heavy";
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
  // polish-3d: course-shape constraints from the structured intake
  // form. Surfaced via list_structure so Lesson Writer reads the
  // values on every turn (not just the initial one).
  shape?: CourseShape;
}

export interface BlockType {
  id: string;
  label: string;
  icon: string;
  col: string;
}
