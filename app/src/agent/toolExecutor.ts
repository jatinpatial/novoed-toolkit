import type { AgentActions, CaseStudyContent, WriterBlock } from "./AgentContext";
import type { BrandKey } from "../brand/tokens";
import type { BlockData, CaseStudy, Course, QuizQuestion } from "../course/types";
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
    case "write_lesson": {
      const lessonId = asString(args.lesson_id, "lesson_id");
      // polish-3a: runtime sanitizer rewrites text blocks that lead
      // with a markdown heading line into a sectionHeader + stripped-
      // text pair. Belt-and-suspenders defense — the prompt bans
      // headings inside text content, but the sanitizer ensures that
      // even when the agent slips, the LD never sees raw "## Title"
      // rendered as text body.
      const blocks = sanitizeWriterBlocks(parseWriterBlocks(args.blocks));
      const result = actions.writeLesson(lessonId, blocks);
      return {
        ok: true,
        replaced: result.replaced,
        added: result.added,
        message: `Lesson updated — ${result.replaced} prior writer block(s) replaced, ${result.added} new block(s) written.`,
      };
    }
    case "write_script": {
      const videoBlockId = asString(args.video_block_id, "video_block_id");
      const script = asString(args.script, "script");
      const result = actions.writeScript(videoBlockId, script);
      return {
        ok: result.ok,
        previousScriptLength: result.previousScriptLength,
        message: result.ok
          ? `Script ${result.previousScriptLength > 0 ? "regenerated" : "written"} — ${script.length} chars on video block ${videoBlockId}.`
          : `No video block found with id ${videoBlockId}.`,
      };
    }
    case "write_knowledge_check": {
      const targetKind = asString(args.target_kind, "target_kind") as "lesson" | "module";
      const targetId = asString(args.target_id, "target_id");
      const questions = parseQuizQuestions(args.questions);
      const result = actions.writeKnowledgeCheck(targetKind, targetId, questions);
      return {
        ok: result.ok,
        replaced: result.replaced,
        message: result.ok
          ? `Knowledge check ${result.replaced ? "replaced" : "written"} — ${questions.length} question(s) on ${targetKind} ${targetId}.`
          : `No ${targetKind} found with id ${targetId}.`,
      };
    }
    case "regenerate_question": {
      const targetKind = asString(args.target_kind, "target_kind") as "lesson" | "module";
      const targetId = asString(args.target_id, "target_id");
      const questionIndex = Number(args.question_index ?? -1);
      if (!Number.isInteger(questionIndex) || questionIndex < 0) {
        throw new Error("question_index must be a non-negative integer");
      }
      const question = parseQuizQuestion(args.question, "question");
      const result = actions.regenerateQuestion(targetKind, targetId, questionIndex, question);
      return {
        ok: result.ok,
        message: result.ok
          ? `Question ${questionIndex + 1} regenerated on ${targetKind} ${targetId}.`
          : `Couldn't find question ${questionIndex + 1} on ${targetKind} ${targetId}.`,
      };
    }
    case "design_case_study": {
      const caseStudyId = asString(args.case_study_id, "case_study_id");
      const content = parseCaseStudyContent(args.content);
      const result = actions.designCaseStudy(caseStudyId, content);
      return {
        ok: result.ok,
        message: result.ok
          ? `Case study ${caseStudyId} filled — ${content.stakeholders.length} stakeholder(s), ${content.decisionPoints.length} decision point(s), ${content.debriefPrompts.length} debrief prompt(s).`
          : `No case study slot found with id ${caseStudyId}. (Course Architect plants slots; if none exist, ask the LD to add one.)`,
      };
    }
    case "read_materials": {
      const course = actions.getCourse();
      const materials = course?.materials ?? [];
      if (materials.length === 0) {
        return { ok: true, count: 0, charCount: 0, text: "" };
      }
      const text = materials
        .map((m) => `=== ${m.filename} ===\n${m.text}`)
        .join("\n\n");
      return { ok: true, count: materials.length, charCount: text.length, text };
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
      // Module-level knowledge check shape so Quiz Builder picks Write vs Replace.
      knowledgeCheck: m.knowledgeCheck
        ? { questionCount: m.knowledgeCheck.questions.length }
        : null,
      // Single-ref to a case-study slot, if Course Architect planted one.
      caseStudyId: m.caseStudyId ?? null,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        duration: l.duration,
        knowledgeCheck: l.knowledgeCheck
          ? { questionCount: l.knowledgeCheck.questions.length }
          : null,
        blocks: l.blocks.map((b) => {
          const base = {
            id: b.id,
            type: b.type,
            summary: summarizeBlock(b.type, b.data),
          };
          // Video blocks get hasScript + videoType so the Synthesia
          // Scriptwriter can (a) pick Write vs Regenerate and (b) match
          // the right voice for speaker (presenter) vs narration (voice-over).
          if (b.type === "video") {
            return {
              ...base,
              hasScript: typeof b.data.script === "string" && b.data.script.trim().length > 0,
              videoType: b.data.videoType ?? "speaker",
            };
          }
          return base;
        }),
      })),
    })),
    // Case-study slots planted by Course Architect. hasContent tells the
    // Case Study Designer whether to fill a fresh slot or replace existing
    // content. titles come from Course Architect; ids are stable.
    caseStudies: (course.caseStudies ?? []).map((cs) => ({
      id: cs.id,
      title: cs.title,
      hasContent: cs.context.trim().length > 0 || cs.stakeholders.length > 0,
    })),
  };
}

/**
 * summarizeBlock — short human-readable digest of a block's contents,
 * used in list_structure responses so the agent knows what's already
 * in a lesson when planning a regenerate or follow-up turn.
 *
 * AI-1e: extended for the new block types from AI-1b (banner with
 * imageUrl variant, quote, clickInstruction, sectionHeader). Without
 * these branches the agent would see "(no url)" or empty strings for
 * the new types and lose structural awareness.
 */
function summarizeBlock(type: string, data: BlockData): string {
  if (type === "text" || type === "clickInstruction") return truncate(data.content || "", 80);
  if (type === "video" || type === "image") return data.url || "(no url)";
  // Banner: noting whether it's the gradient-only or photo-statement
  // variant helps the agent decide whether to keep, swap, or remove
  // on regenerate. callout: surface the type variant so the agent
  // sees note vs tip vs warning at a glance.
  if (type === "banner") {
    const head = truncate(data.title || data.body || "", 60);
    return data.imageUrl ? `[photo] ${head}` : head;
  }
  if (type === "callout") {
    const variant = data.type || "tip";
    return `[${variant}] ${truncate(data.body || "", 60)}`;
  }
  if (type === "quote") {
    const body = truncate(data.body || "", 60);
    const attr = data.attribution ? ` — ${data.attribution}` : "";
    return body + attr;
  }
  if (type === "sectionHeader") {
    const icon = data.iconName ? ` (${data.iconName})` : "";
    return truncate(data.title || "", 60) + icon;
  }
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
  const caseStudyTitle =
    typeof m.case_study_title === "string" ? m.case_study_title :
    typeof m.caseStudyTitle === "string" ? m.caseStudyTitle :
    undefined;
  return { weekNumber, title, summary, objectives, lessons, caseStudyTitle };
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

/**
 * parseWriterBlocks — validates the agent's write_lesson payload (AI-1a).
 *
 * Accepts two shapes per block:
 *   { type, content }      — text-only (legacy; still the right shape for
 *                            text/divider blocks where the content IS the
 *                            payload)
 *   { type, data: {...} }  — structured (banner, callout, accordion,
 *                            flipcard, cards, stats, timeline, statement,
 *                            quote, clickInstruction, sectionHeader, etc.)
 *
 * Exactly one of content / data must be present. If both arrive, prefer
 * `data` and ignore `content` (structured wins; the agent shouldn't send
 * both, but if it does we don't want silent data loss either way).
 */
/**
 * sanitizeWriterBlocks — runtime defense against text blocks that
 * lead with a markdown heading (polish-3a).
 *
 * Pattern caught:
 *   { type: "text", content: "## Your mandate as change leader\n\nMost pharma..." }
 *
 * Rewrites to:
 *   { type: "sectionHeader", data: { title: "Your mandate as change leader", iconName: "target" } }
 *   { type: "text", content: "Most pharma..." }
 *
 * The prompt explicitly bans this pattern (see config.py MODE 2's
 * Voice & grounding section). The sanitizer runs at the
 * write_lesson dispatch boundary so even when the agent slips, the
 * LD never sees raw heading markers rendered as body text.
 *
 * Only catches the leading heading — multi-heading text blocks slip
 * through with second+ headings still as raw text. If the live test
 * shows the agent emitting multiple headings inside a single text
 * block, lift to a recursive splitter.
 */
function sanitizeWriterBlocks(blocks: WriterBlock[]): WriterBlock[] {
  const out: WriterBlock[] = [];
  for (const b of blocks) {
    if (b.type !== "text" || !b.content) {
      out.push(b);
      continue;
    }
    // Match a leading heading line: "# Title", "## Title", … with
    // optional trailing newline(s). Captures heading level + text.
    const m = b.content.match(/^(#{1,6})\s+([^\r\n]+?)(?:\r?\n+|$)/);
    if (!m) {
      out.push(b);
      continue;
    }
    const level = m[1].length;
    const headingText = m[2].trim();
    const stripped = b.content.slice(m[0].length).replace(/^[\r\n]+/, "");
    out.push({
      type: "sectionHeader",
      data: { title: headingText, iconName: pickIconForHeading(headingText, level) },
    });
    if (stripped.length > 0) {
      // Keep the original block's other fields (e.g. data) by spreading;
      // override content with the stripped body.
      out.push({ ...b, content: stripped });
    }
  }
  return out;
}

/**
 * pickIconForHeading — heuristic mapping from heading text + level to
 * one of the 12 curated section icons (polish-3a). Keyword-first
 * matching falls through to a level-default. Names match
 * SECTION_ICON_NAMES in app/src/course/blockTypes.ts; out-of-set
 * names get fallback rendering at the section-header component
 * level.
 */
function pickIconForHeading(text: string, level: number): string {
  const lower = text.toLowerCase();
  if (/key.*takeaway|summary|recap|wrap.?up|conclud/.test(lower)) return "check";
  if (/objective|goal|aim|outcome|mandate/.test(lower)) return "target";
  if (/why.*matter|why.*this|impact|why.*need|stakes|cost/.test(lower)) return "trendingUp";
  if (/reflect|consider|think.*about|discussion/.test(lower)) return "quote";
  if (/example|show|case|demo|illustration/.test(lower)) return "lightbulb";
  if (/note|caveat|important|watch.*for|pitfall|risk/.test(lower)) return "alertCircle";
  if (/highlight|key.*insight|spotlight|standout/.test(lower)) return "sparkles";
  if (/stakeholder|audience|role|people|team|cast/.test(lower)) return "users";
  if (/learn|practice|apply|do|walkthrough/.test(lower)) return "pencil";
  if (/concept|model|framework|theory/.test(lower)) return "brain";
  if (/source|reference|further.*read|material/.test(lower)) return "bookOpen";
  if (/time|duration|pacing|schedule/.test(lower)) return "clock";
  // Level-based fallback when no keyword matches.
  return level === 1 ? "target" : level === 2 ? "trendingUp" : "bookOpen";
}

function parseWriterBlocks(raw: unknown): WriterBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("blocks must be a non-empty array");
  }
  return raw.map((b, i) => {
    if (typeof b !== "object" || b === null) {
      throw new Error(`block #${i + 1} must be an object`);
    }
    const obj = b as Record<string, unknown>;
    const type = asString(obj.type, `block #${i + 1} type`);
    const hasContent = typeof obj.content === "string";
    const hasData = typeof obj.data === "object" && obj.data !== null && !Array.isArray(obj.data);
    if (!hasContent && !hasData) {
      throw new Error(
        `block #${i + 1} must have either 'content' (string) or 'data' (object)`,
      );
    }
    const content = hasContent ? (obj.content as string) : undefined;
    const data = hasData ? (obj.data as Partial<BlockData>) : undefined;
    return { type, content, data };
  });
}

function parseStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const filtered = v.filter((x): x is string => typeof x === "string");
  return filtered.length > 0 ? filtered : undefined;
}

function parseQuizQuestion(raw: unknown, label: string): QuizQuestion {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${label} must be an object`);
  }
  const q = raw as Record<string, unknown>;
  const type = asString(q.type, `${label}.type`);
  const stem = asString(q.stem, `${label}.stem`);
  if (type === "mcq") {
    const optionsRaw = q.options;
    if (!Array.isArray(optionsRaw) || optionsRaw.length < 2) {
      throw new Error(`${label}.options must be an array of at least 2 strings`);
    }
    const options = optionsRaw.map((o, i) => asString(o, `${label}.options[${i}]`));
    const correctIndex = Number(q.correctIndex ?? -1);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`${label}.correctIndex must be a valid index into options`);
    }
    const rationale = asString(q.rationale, `${label}.rationale`);
    return { type: "mcq", stem, options, correctIndex, rationale };
  }
  if (type === "short") {
    const hintsRaw = q.expectedAnswerHints;
    if (!Array.isArray(hintsRaw) || hintsRaw.length === 0) {
      throw new Error(`${label}.expectedAnswerHints must be a non-empty array`);
    }
    const expectedAnswerHints = hintsRaw.map((h, i) => asString(h, `${label}.expectedAnswerHints[${i}]`));
    return { type: "short", stem, expectedAnswerHints };
  }
  throw new Error(`${label}.type must be "mcq" or "short" (got ${JSON.stringify(type)})`);
}

function parseQuizQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("questions must be a non-empty array");
  }
  return raw.map((q, i) => parseQuizQuestion(q, `questions[${i}]`));
}

function parseCaseStudyContent(raw: unknown): CaseStudyContent {
  const obj = asObject(raw, true);
  const context = asString(obj.context, "content.context");
  const stakeholdersRaw = obj.stakeholders;
  if (!Array.isArray(stakeholdersRaw) || stakeholdersRaw.length === 0) {
    throw new Error("content.stakeholders must be a non-empty array");
  }
  const stakeholders: CaseStudy["stakeholders"] = stakeholdersRaw.map((s, i) => {
    const sObj = asObject(s, true);
    return {
      name: asString(sObj.name, `content.stakeholders[${i}].name`),
      role: asString(sObj.role, `content.stakeholders[${i}].role`),
      voice: asString(sObj.voice, `content.stakeholders[${i}].voice`),
    };
  });
  const decisionPoints = (parseStringArray(obj.decisionPoints) ?? []).filter((s) => s.trim().length > 0);
  if (decisionPoints.length === 0) {
    throw new Error("content.decisionPoints must be a non-empty array of strings");
  }
  const debriefPrompts = (parseStringArray(obj.debriefPrompts) ?? []).filter((s) => s.trim().length > 0);
  if (debriefPrompts.length === 0) {
    throw new Error("content.debriefPrompts must be a non-empty array of strings");
  }
  return { context, stakeholders, decisionPoints, debriefPrompts };
}
