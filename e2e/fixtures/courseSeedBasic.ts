import type { Course } from "@app/course/types";

/**
 * Baseline course shape every mocked test starts from. One module,
 * one lesson, one video block. The ids are stable strings (not
 * randomized) so tests can reference them directly without round-tripping
 * through list_structure.
 */

export const COURSE_ID = "e2e-course";
export const MODULE_ID = "e2e-module";
export const LESSON_ID = "e2e-lesson";
export const VIDEO_BLOCK_ID = "e2e-video-block";

export interface SeededProject {
  id: string;
  name: string;
  kind: "course";
  brand: "bcgu";
  data: { kind: "course"; course: Course };
  createdAt: number;
  updatedAt: number;
}

export function courseSeedBasic(): SeededProject {
  const course: Course = {
    id: COURSE_ID,
    title: "E2E Test Course",
    client: "",
    brand: "bcgu",
    modules: [
      {
        id: MODULE_ID,
        title: "Module 1: Foundations",
        weekNumber: 1,
        summary: "Introductory concepts.",
        objectives: ["Identify the core idea.", "Apply the framework once."],
        lessons: [
          {
            id: LESSON_ID,
            title: "1.1 Why change is hard",
            duration: 10,
            blocks: [
              {
                id: VIDEO_BLOCK_ID,
                type: "video",
                data: { url: "", caption: "Intro video", videoType: "speaker" },
              },
            ],
          },
        ],
      },
    ],
  };
  const now = Date.now();
  return {
    id: COURSE_ID,
    name: course.title,
    kind: "course",
    brand: "bcgu",
    data: { kind: "course", course },
    createdAt: now,
    updatedAt: now,
  };
}
