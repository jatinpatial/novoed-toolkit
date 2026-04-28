import type { QuizQuestion } from "@app/course/types";
import { COURSE_ID, MODULE_ID, LESSON_ID, VIDEO_BLOCK_ID } from "../fixtures/courseSeedBasic";

/**
 * Canned tool-result payloads for the WS mock. Keyed by tool name so
 * specs can read like prose: `cannedListStructure()`, `cannedQuiz()`.
 * Edit the data here when the FE schema changes; specs stay clean.
 */

export function cannedListStructure() {
  return {
    course: { id: COURSE_ID, title: "E2E Test Course", brand: "bcgu", client: "" },
    modules: [
      {
        id: MODULE_ID,
        title: "Module 1: Foundations",
        knowledgeCheck: null,
        caseStudyId: null,
        lessons: [
          {
            id: LESSON_ID,
            title: "1.1 Why change is hard",
            duration: 10,
            knowledgeCheck: null,
            blocks: [
              {
                id: VIDEO_BLOCK_ID,
                type: "video",
                summary: "(no url)",
                hasScript: false,
                videoType: "speaker",
              },
            ],
          },
        ],
      },
    ],
    caseStudies: [],
  };
}

export function cannedFiveMCQs(): QuizQuestion[] {
  return [
    {
      type: "mcq",
      stem: "Which factor most often derails change initiatives?",
      options: ["Lack of executive sponsorship", "Insufficient budget", "Wrong consultant", "Bad weather"],
      correctIndex: 0,
      rationale: "Sponsorship is the dominant predictor in BCG change reviews. Budget matters, but presence/absence of an active sponsor is the better signal.",
    },
    {
      type: "mcq",
      stem: "A frontline manager pushes back. What's the first move?",
      options: ["Override and proceed", "Listen for the underlying concern", "Delay the rollout", "Replace the manager"],
      correctIndex: 1,
      rationale: "Push-back usually surfaces a legitimate operational concern. Listening first preserves trust and often uncovers a fixable issue.",
    },
    {
      type: "mcq",
      stem: "Identify the strongest leading indicator of change adoption.",
      options: ["Town-hall attendance", "Behavior change in the first 30 days", "Survey sentiment", "Email open rate"],
      correctIndex: 1,
      rationale: "Behavior beats sentiment. The first 30 days reveal whether the change is taking root.",
    },
    {
      type: "mcq",
      stem: "Which Bloom's level does scenario-based MCQ best target?",
      options: ["Remember", "Understand", "Apply", "Create"],
      correctIndex: 2,
      rationale: "Scenarios force the learner to apply a framework to a novel situation — the apply level. Remember/understand are recall-only.",
    },
    {
      type: "mcq",
      stem: "What's the right response when sponsorship wavers mid-initiative?",
      options: ["Hide the slowdown from the team", "Re-engage the sponsor with a clear forward-look", "Cancel the program", "Wait for a new quarter"],
      correctIndex: 1,
      rationale: "Sponsorship lapses are common. Re-engaging with a concrete forward-look usually restores momentum without restarting the program.",
    },
  ];
}
