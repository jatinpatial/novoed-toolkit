import type { Course } from "@app/course/types";
import { courseSeedBasic, MODULE_ID, type SeededProject } from "./courseSeedBasic";

/**
 * Specialized seed shapes layered on top of courseSeedBasic. Each
 * helper takes the basic seed and extends it for a specific test
 * scenario — case-study slot pre-planted, knowledge check pre-filled,
 * etc. Tests load these via seedCourseInStorage.
 */

export const CASE_STUDY_ID = "e2e-case-study-slot";

/**
 * Course with module 1 anchored on a planted case-study slot that
 * has no content yet. Used by the case-study design test, which
 * exercises the empty-slot CTA → Case Study Designer flow.
 */
export function courseSeedWithCaseStudySlot(title = "Vantix Pharma: Pricing under margin pressure"): SeededProject {
  const seed = courseSeedBasic();
  const course: Course = {
    ...seed.data.course,
    modules: seed.data.course.modules.map((m) =>
      m.id === MODULE_ID ? { ...m, caseStudyId: CASE_STUDY_ID } : m,
    ),
    caseStudies: [
      {
        id: CASE_STUDY_ID,
        title,
        context: "",
        stakeholders: [],
        decisionPoints: [],
        debriefPrompts: [],
      },
    ],
  };
  return {
    ...seed,
    data: { kind: "course", course },
  };
}
