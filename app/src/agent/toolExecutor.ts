import type { AgentActions } from "./AgentContext";
import type { BrandKey } from "../brand/tokens";
import type { BlockData, Course } from "../course/types";
import type { CourseOutlineProposal, ProposedModule, ProposedLesson } from "./types";

export async function dispatchToolCall(
  actions: AgentActions,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "navigate": {
      await actions.navigate(asString(args.route, "route"));
      return { ok: true };
    }
    case "set_brand": {
      actions.setBrand(asString(args.brand, "brand") as BrandKey);
      return { ok: true };
    }
    case "propose_course_outline": {
      const proposal = parseProposal(args);
      if (!actions.setOutlineProposal) {
        throw new Error("This page can't accept course proposals — open Course Studio with no course selected to propose a new one.");
      }
      actions.setOutlineProposal(proposal);
      return {
        ok: true,
        message: "Outline shown to the LD. Stop here — the LD reviews and clicks 'Build this course' to create it.",
      };
    }
    case "list_structure": {
      const course = actions.getCourse();
      return course ? summarizeCourse(course) : { course: null };
    }
    case "add_module": {
      return actions.addModule(asString(args.title, "title"));
    }
    case "add_lesson": {
      return actions.addLesson(
        asString(args.module_id, "module_id"),
        asString(args.title, "title"),
        typeof args.duration === "number" ? args.duration : undefined,
      );
    }
    case "add_block": {
      return actions.addBlock(
        asString(args.lesson_id, "lesson_id"),
        asString(args.block_type, "block_type"),
        asObject(args.data) as Partial<BlockData>,
      );
    }
    case "update_block": {
      actions.updateBlock(
        asString(args.block_id, "block_id"),
        asObject(args.data, true) as Partial<BlockData>,
      );
      return { ok: true };
    }
    case "delete_block": {
      actions.deleteBlock(asString(args.block_id, "block_id"));
      return { ok: true };
    }
    case "reorder": {
      actions.reorder(
        asString(args.entity_kind, "entity_kind") as "module" | "lesson" | "block",
        asString(args.entity_id, "entity_id"),
        Number(args.new_index ?? 0),
      );
      return { ok: true };
    }
    case "export_lesson": {
      actions.exportLesson(
        asString(args.lesson_id, "lesson_id"),
        asString(args.format, "format") as "scorm" | "json",
      );
      return { ok: true };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  return v;
}

function asObject(v: unknown, required = false): Record<string, unknown> {
  if (v == null) {
    if (required) throw new Error("expected object, got null");
    return {};
  }
  if (typeof v !== "object" || Array.isArray(v)) throw new Error("expected object");
  return v as Record<string, unknown>;
}

function summarizeCourse(course: Course) {
  return {
    course: { id: course.id, title: course.title, brand: course.brand, client: course.client },
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        duration: l.duration,
        blocks: l.blocks.map((b) => ({
          id: b.id,
          type: b.type,
          summary: summarizeBlock(b.type, b.data),
        })),
      })),
    })),
  };
}

function summarizeBlock(type: string, data: BlockData): string {
  if (type === "text") return truncate(data.content || "", 80);
  if (type === "video" || type === "image") return data.url || "(no url)";
  if (type === "banner" || type === "callout") return truncate(data.title || data.body || "", 80);
  if (data.items) return `${data.items.length} items`;
  return data.title ? truncate(data.title, 60) : "";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function parseProposal(args: Record<string, unknown>): CourseOutlineProposal {
  const title = asString(args.title, "title");
  const durationWeeks = Number(args.duration_weeks ?? args.durationWeeks ?? 0);
  if (!Number.isFinite(durationWeeks) || durationWeeks < 1) {
    throw new Error("duration_weeks must be a positive integer");
  }
  const rawModules = args.modules;
  if (!Array.isArray(rawModules) || rawModules.length === 0) {
    throw new Error("modules must be a non-empty array");
  }
  const modules: ProposedModule[] = rawModules.map((m, i) => parseModule(m, i));
  const audience = typeof args.audience === "string" ? args.audience : undefined;
  return { title, audience, durationWeeks, modules };
}

function parseModule(raw: unknown, index: number): ProposedModule {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`module #${index + 1} must be an object`);
  }
  const m = raw as Record<string, unknown>;
  const weekNumber = Number(m.week_number ?? m.weekNumber ?? index + 1);
  const title = asString(m.title, `module #${index + 1} title`);
  const summary = typeof m.summary === "string" ? m.summary : undefined;
  const objectives = parseStringArray(m.objectives);
  const rawLessons = m.lessons;
  if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
    throw new Error(`module #${index + 1} must have at least one lesson`);
  }
  const lessons: ProposedLesson[] = rawLessons.map((l, j) => parseLesson(l, index, j));
  return { weekNumber, title, summary, objectives, lessons };
}

function parseLesson(raw: unknown, modIndex: number, lessonIndex: number): ProposedLesson {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`lesson #${modIndex + 1}.${lessonIndex + 1} must be an object`);
  }
  const l = raw as Record<string, unknown>;
  const title = asString(l.title, `lesson ${modIndex + 1}.${lessonIndex + 1} title`);
  const durationMin =
    typeof l.duration_min === "number" ? l.duration_min :
    typeof l.durationMin === "number" ? l.durationMin :
    undefined;
  const objectives = parseStringArray(l.objectives);
  return { title, durationMin, objectives };
}

function parseStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const filtered = v.filter((x): x is string => typeof x === "string");
  return filtered.length > 0 ? filtered : undefined;
}
