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

      // QQ2: stream the blocks into the lesson one at a time with a
      // small delay so the LD watches the content form rather than a
      // big atomic dump. Same wall-clock time, different felt
      // experience — same psychology that makes ChatGPT compelling.
      // We do progressively-larger writes (replace lesson with first
      // N blocks, then first N+1, etc.) so the lesson always reflects
      // a coherent intermediate state. The last write returns the
      // canonical result we hand back to the agent.
      const STREAM_DELAY_MS = 80;
      let lastResult = { ok: true, replaced: 0, added: 0 };
      if (blocks.length === 0) {
        lastResult = actions.writeLesson(lessonId, []);
      } else {
        for (let i = 1; i <= blocks.length; i++) {
          lastResult = actions.writeLesson(lessonId, blocks.slice(0, i));
          // Bail early if the lesson_id is wrong — no point staggering
          // writes that aren't landing.
          if (!lastResult.ok) break;
          if (i < blocks.length) {
            await new Promise<void>((resolve) =>
              setTimeout(resolve, STREAM_DELAY_MS),
            );
          }
        }
      }
      // polish-16b: surface ok/error truthfully so the agent + the
      // orchestrator's retry path can react when a lesson_id mismatch
      // produces zero writes. Pre-fix this always returned ok: true,
      // so a wrong lesson_id silently marked the lesson "done" with
      // zero blocks — exactly the lesson-1.1 zero-blocks regression
      // from the BCG playbook test.
      return {
        ok: lastResult.ok,
        replaced: lastResult.replaced,
        added: lastResult.added,
        message: lastResult.ok
          ? `Lesson updated — ${lastResult.replaced} prior writer block(s) replaced, ${lastResult.added} new block(s) written.`
          : `No lesson found with id ${lessonId}. Call list_structure to get the current lesson ids; do not retry with the same id.`,
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
    case "write_infographic": {
      // Track-G: standalone Infographic Studio write path. Same
      // ok/false silent-success protection as polish-16b's writeLesson.
      const infographicId = asString(args.infographic_id, "infographic_id");
      if (!actions.writeInfographic) {
        throw new Error(
          "write_infographic isn't supported here — open Infographic Studio (/infographics/new → /infographics/:id).",
        );
      }
      const title = asString(args.title, "title");
      const subtitle = typeof args.subtitle === "string" ? args.subtitle : "";
      const rawPoints = Array.isArray(args.points) ? args.points : [];
      const points = rawPoints.map((p, i) => {
        if (!p || typeof p !== "object") {
          throw new Error(`points[${i}] must be an object`);
        }
        const obj = p as Record<string, unknown>;
        return {
          heading: asString(obj.heading, `points[${i}].heading`),
          body: asString(obj.body, `points[${i}].body`),
          iconHint: typeof obj.iconHint === "string" ? obj.iconHint : undefined,
        };
      });
      const result = actions.writeInfographic(infographicId, { title, subtitle, points });
      return {
        ok: result.ok,
        message: result.ok
          ? `Infographic written — ${points.length} point(s) on "${title}".`
          : `No infographic found with id ${infographicId}. Call list_structure to verify.`,
      };
    }
    case "read_materials": {
      // Track-B: prefer course.materials when a course is open; fall
      // back to pendingMaterials (uploaded during brief flow before
      // any course exists) so Course Architect can read source
      // content while proposing the outline.
      const course = actions.getCourse();
      let materials = course?.materials ?? [];
      if (materials.length === 0 && actions.getPendingMaterials) {
        materials = actions.getPendingMaterials();
      }
      if (materials.length === 0) {
        return { ok: true, count: 0, charCount: 0, text: "" };
      }
      const text = materials
        .map((m) => `=== ${m.filename} ===\n${m.text}`)
        .join("\n\n");

      // Track-SD (Source-Deck deepen): for PPTX materials with
      // structured slide metadata, surface the slide list to the
      // agent. The agent's MODE 1 (Course Architect) prompt instructs
      // it to use these for module boundary detection + slide-range
      // citation per generated lesson. Agents that don't need them
      // (e.g. MODE 6 Infographic Builder) will simply ignore the
      // field. Decks that were uploaded BEFORE this field existed
      // have undefined `structured` and fall through to flat text.
      const structuredMaterials = materials
        .filter((m) => m.structured && m.structured.slides.length > 0)
        .map((m) => ({
          filename: m.filename,
          totalSlides: m.structured!.totalSlides,
          sectionCount: m.structured!.sectionCount,
          slides: m.structured!.slides,
        }));

      const response: Record<string, unknown> = {
        ok: true,
        count: materials.length,
        charCount: text.length,
        text,
      };
      if (structuredMaterials.length > 0) {
        response.structured = structuredMaterials;
      }
      return response;
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
    // polish-3d: include course.shape in list_structure output so
    // Lesson Writer reads the constraints on every turn (not just
    // the initial Course Architect pass). Omitted when undefined so
    // the agent doesn't see {} — only the keys the LD steered.
    course: {
      id: course.id,
      title: course.title,
      brand: course.brand,
      client: course.client,
      ...(course.shape ? { shape: course.shape } : {}),
    },
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
  // polish-3d: optional shape field forwarded by Course Architect when
  // the LD's brief specified Course shape constraints. Defensive parse
  // so a missing or malformed shape doesn't tank the whole proposal.
  const shape = parseShape(args.shape);
  return { title, audience, durationWeeks, modules, shape };
}

/**
 * parseShape — defensive parser for the optional `shape` arg on
 * propose_course_outline. Each field accepts the agent's emission OR
 * undefined; unknown values fall back to "auto" / "mixed" sentinels.
 */
function parseShape(raw: unknown): import("../course/types").CourseShape | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  const out: import("../course/types").CourseShape = {};

  const cs = obj.caseStudies ?? obj.case_studies;
  if (cs === "auto" || cs === "none") {
    out.caseStudies = cs;
  } else if (typeof cs === "number" && (cs === 1 || cs === 2 || cs === 3)) {
    out.caseStudies = cs;
  } else if (typeof cs === "string" && /^[123]$/.test(cs)) {
    out.caseStudies = parseInt(cs, 10) as 1 | 2 | 3;
  }

  const vs = obj.videoScripts ?? obj.video_scripts;
  if (vs === "auto" || vs === "none" || vs === "key" || vs === "every") {
    out.videoScripts = vs;
  }

  const kc = obj.knowledgeChecks ?? obj.knowledge_checks;
  if (kc === "auto" || kc === "lesson" || kc === "module" || kc === "both") {
    out.knowledgeChecks = kc;
  }

  const it = obj.interactivity;
  if (it === "light" || it === "mixed" || it === "heavy") {
    out.interactivity = it;
  }

  return Object.keys(out).length > 0 ? out : undefined;
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
