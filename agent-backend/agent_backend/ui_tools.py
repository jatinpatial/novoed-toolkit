"""UI tools — each forwards the call to the FE via ToolBridge and returns the result to the agent.

Tool input schemas are declared as plain dicts (JSON Schema). Tool implementations are thin: they
just delegate to `bridge.call(name, args)`. The *actual* execution happens in the React app via
the tool executor wired to React Context.
"""
from typing import Any
from claude_agent_sdk import tool, create_sdk_mcp_server

from .bridge import ToolBridge


def _wrap(result: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": str(result)}]}


def build_ui_mcp_server(bridge: ToolBridge):
    async def _forward(name: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            result = await bridge.call(name, args)
            return _wrap(result if result is not None else "ok")
        except Exception as exc:  # surfaces back to agent as a tool error message
            return {
                "content": [{"type": "text", "text": f"tool error: {exc}"}],
                "isError": True,
            }

    # --- navigation / global ---

    @tool("navigate", "Navigate the app to a top-level route.", {
        "type": "object",
        "properties": {"route": {"type": "string", "enum": ["/", "/course-builder"]}},
        "required": ["route"],
    })
    async def navigate(args):
        return await _forward("navigate", args)

    @tool("set_brand", "Set the active brand theme.", {
        "type": "object",
        "properties": {"brand": {"type": "string", "enum": ["bcg", "bcgu", "custom"]}},
        "required": ["brand"],
    })
    async def set_brand(args):
        return await _forward("set_brand", args)

    # --- course architect: propose ---

    @tool(
        "propose_course_outline",
        (
            "Propose a structured course outline for the LD to review. The LD will see the outline "
            "rendered in the UI and clicks 'Build this course' to create it; the UI then handles "
            "building. Do NOT call add_module / add_lesson after this — your turn ends with this call."
        ),
        {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Course title."},
                "audience": {
                    "type": "string",
                    "description": "Who the course is for, in plain English (e.g. 'senior managers leading change initiatives').",
                },
                "duration_weeks": {"type": "integer", "minimum": 1, "maximum": 52},
                "modules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "week_number": {"type": "integer", "minimum": 1},
                            "title": {"type": "string"},
                            "summary": {
                                "type": "string",
                                "description": "One sentence describing what this week covers.",
                            },
                            "objectives": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "2-4 measurable learning objectives starting with a verb.",
                            },
                            "lessons": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {
                                            "type": "string",
                                            "description": "Format: '{module}.{lesson} {Title}', e.g. '1.1 Why change is hard'.",
                                        },
                                        "duration_min": {"type": "integer", "minimum": 1},
                                        "objectives": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                    "required": ["title"],
                                },
                            },
                        },
                        "required": ["week_number", "title", "lessons"],
                    },
                },
            },
            "required": ["title", "duration_weeks", "modules"],
        },
    )
    async def propose_course_outline(args):
        return await _forward("propose_course_outline", args)

    # --- lesson writer ---

    @tool(
        "write_lesson",
        (
            "Write or regenerate the body of a single lesson. Replaces any prior writer-generated "
            "blocks in the lesson with the new ones; manually-authored blocks are preserved. Provide "
            "3-5 text blocks covering Hook → Body → Examples → Summary, in order."
        ),
        {
            "type": "object",
            "properties": {
                "lesson_id": {"type": "string"},
                "blocks": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": ["text"]},
                            "content": {
                                "type": "string",
                                "description": "Markdown body. Open with a bold section label (**Hook**, **Body**, **Examples**, **Summary**).",
                            },
                        },
                        "required": ["type", "content"],
                    },
                },
            },
            "required": ["lesson_id", "blocks"],
        },
    )
    async def write_lesson(args):
        return await _forward("write_lesson", args)

    @tool(
        "read_materials",
        (
            "Return the concatenated text of every source-material file the LD has uploaded for "
            "the current course (PPTX, PDF, DOCX, TXT, MD). Use this before write_lesson when the "
            "course has materials, so the lesson body is grounded in them. Quote sparingly; "
            "paraphrase otherwise. If no materials are attached, returns an empty string."
        ),
        {"type": "object", "properties": {}},
    )
    async def read_materials(args):
        return await _forward("read_materials", args)

    # --- synthesia scriptwriter ---

    @tool(
        "write_script",
        (
            "Write or regenerate a Synthesia avatar script for a single video block. Replaces "
            "the existing script on that block, if any. The script is a single plain-text string "
            "with inline cue markers: [PAUSE], [ON-SCREEN: …], [B-ROLL: …]. ~150 wpm pacing, "
            "sentences <12 words. Default target ~90 seconds (~225 words) unless specified."
        ),
        {
            "type": "object",
            "properties": {
                "video_block_id": {
                    "type": "string",
                    "description": "Real id of the target video block (NOT a display label like '1.2'). Get it from list_structure.",
                },
                "script": {
                    "type": "string",
                    "description": "Full plain-text script with inline [PAUSE] / [ON-SCREEN: …] / [B-ROLL: …] cues.",
                },
            },
            "required": ["video_block_id", "script"],
        },
    )
    async def write_script(args):
        return await _forward("write_script", args)

    # --- course builder: read ---

    @tool(
        "list_structure",
        "Return the current course tree: course meta plus modules, lessons, and blocks with ids, types, and a short summary of each block. Use this before proposing edits.",
        {"type": "object", "properties": {}},
    )
    async def list_structure(args):
        return await _forward("list_structure", args)

    # --- course builder: structural edits ---

    @tool("add_module", "Append a module to the current course.", {
        "type": "object",
        "properties": {"title": {"type": "string"}},
        "required": ["title"],
    })
    async def add_module(args):
        return await _forward("add_module", args)

    @tool("add_lesson", "Append a lesson to a module.", {
        "type": "object",
        "properties": {
            "module_id": {"type": "string"},
            "title": {"type": "string"},
            "duration": {"type": "string", "description": "e.g. '10 min'"},
        },
        "required": ["module_id", "title"],
    })
    async def add_lesson(args):
        return await _forward("add_lesson", args)

    @tool(
        "add_block",
        "Append a block to a lesson. block_type is one of the registered Course Builder types (text, banner, callout, stats, accordion, flip_cards, timeline, quiz, poll, etc.). data is the block-specific payload.",
        {
            "type": "object",
            "properties": {
                "lesson_id": {"type": "string"},
                "block_type": {"type": "string"},
                "data": {"type": "object"},
            },
            "required": ["lesson_id", "block_type"],
        },
    )
    async def add_block(args):
        return await _forward("add_block", args)

    @tool("update_block", "Update a block's data. Pass the full data object or a partial patch.", {
        "type": "object",
        "properties": {
            "block_id": {"type": "string"},
            "data": {"type": "object"},
        },
        "required": ["block_id", "data"],
    })
    async def update_block(args):
        return await _forward("update_block", args)

    @tool("delete_block", "Delete a block. Confirm with the user before calling.", {
        "type": "object",
        "properties": {"block_id": {"type": "string"}},
        "required": ["block_id"],
    })
    async def delete_block(args):
        return await _forward("delete_block", args)

    @tool(
        "reorder",
        "Move an entity (module, lesson, or block) to a new index inside its parent.",
        {
            "type": "object",
            "properties": {
                "entity_kind": {"type": "string", "enum": ["module", "lesson", "block"]},
                "entity_id": {"type": "string"},
                "new_index": {"type": "integer", "minimum": 0},
            },
            "required": ["entity_kind", "entity_id", "new_index"],
        },
    )
    async def reorder(args):
        return await _forward("reorder", args)

    # --- quiz builder ---

    # Reusable schema for one quiz question. Two shapes (mcq / short-answer)
    # via oneOf, both keyed on the `type` discriminator. Mirrors the
    # QuizQuestion union in app/src/course/types.ts.
    quiz_question_schema = {
        "type": "object",
        "oneOf": [
            {
                "properties": {
                    "type": {"const": "mcq"},
                    "stem": {"type": "string", "description": "The question text."},
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 2,
                        "maxItems": 6,
                        "description": "Answer options. Plausible distractors, not joke wrong answers.",
                    },
                    "correctIndex": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "Zero-based index into options.",
                    },
                    "rationale": {
                        "type": "string",
                        "description": "Short paragraph explaining why the correct answer is correct AND why the distractors are tempting but wrong.",
                    },
                },
                "required": ["type", "stem", "options", "correctIndex", "rationale"],
            },
            {
                "properties": {
                    "type": {"const": "short"},
                    "stem": {"type": "string"},
                    "expectedAnswerHints": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 2,
                        "maxItems": 5,
                        "description": "Concepts a complete answer should cover. Used as a grading rubric, not shown to the learner.",
                    },
                },
                "required": ["type", "stem", "expectedAnswerHints"],
            },
        ],
    }

    @tool(
        "write_knowledge_check",
        (
            "Write or replace a knowledge check on a lesson or module. Replaces any prior "
            "knowledge check at the target. Provide 5 questions covering the key learning "
            "objectives, mixing Bloom's-aware difficulty (recall → apply → analyze) across "
            "the set."
        ),
        {
            "type": "object",
            "properties": {
                "target_kind": {
                    "type": "string",
                    "enum": ["lesson", "module"],
                    "description": "lesson = post-lesson recap; module = week's final assessment.",
                },
                "target_id": {
                    "type": "string",
                    "description": "Real lesson_id or module_id from list_structure (NOT a display label like '1.1').",
                },
                "questions": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 8,
                    "items": quiz_question_schema,
                },
            },
            "required": ["target_kind", "target_id", "questions"],
        },
    )
    async def write_knowledge_check(args):
        return await _forward("write_knowledge_check", args)

    @tool(
        "regenerate_question",
        (
            "Regenerate a single question in an existing knowledge check, in place. The other "
            "questions are preserved. Use when the LD says 'rewrite question 3' or 'make Q2 a "
            "short-answer' — generate the replacement and call this tool once."
        ),
        {
            "type": "object",
            "properties": {
                "target_kind": {"type": "string", "enum": ["lesson", "module"]},
                "target_id": {"type": "string"},
                "question_index": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "Zero-based index of the question to swap.",
                },
                "question": quiz_question_schema,
            },
            "required": ["target_kind", "target_id", "question_index", "question"],
        },
    )
    async def regenerate_question(args):
        return await _forward("regenerate_question", args)

    # --- case study designer ---

    @tool(
        "design_case_study",
        (
            "Fill in an empty case-study slot that Course Architect planted in the course outline. "
            "Provide a realistic BCG-style scenario with 3-4 named stakeholders (each with role and "
            "voice), 3-4 decision points the case forces, and 3-4 debrief prompts for the "
            "LD-facilitated discussion. Replaces any prior content at the slot."
        ),
        {
            "type": "object",
            "properties": {
                "case_study_id": {
                    "type": "string",
                    "description": "Real id of a Course.caseStudies entry from list_structure.",
                },
                "content": {
                    "type": "object",
                    "properties": {
                        "context": {
                            "type": "string",
                            "description": "3-5 paragraphs setting up the scenario — company, situation, the call the protagonist faces. BCG-professional voice, plain English.",
                        },
                        "stakeholders": {
                            "type": "array",
                            "minItems": 3,
                            "maxItems": 6,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "role": {"type": "string", "description": "Title and org context."},
                                    "voice": {
                                        "type": "string",
                                        "description": "1-2 sentences in that stakeholder's voice — what they'd say in a meeting about this. Quotable.",
                                    },
                                },
                                "required": ["name", "role", "voice"],
                            },
                        },
                        "decisionPoints": {
                            "type": "array",
                            "minItems": 3,
                            "maxItems": 5,
                            "items": {"type": "string"},
                            "description": "Hard calls the case forces. Phrased as questions the protagonist must answer.",
                        },
                        "debriefPrompts": {
                            "type": "array",
                            "minItems": 3,
                            "maxItems": 5,
                            "items": {"type": "string"},
                            "description": "Reflection questions the LD asks the cohort after the case is run. Bloom's: analyze / evaluate.",
                        },
                    },
                    "required": ["context", "stakeholders", "decisionPoints", "debriefPrompts"],
                },
            },
            "required": ["case_study_id", "content"],
        },
    )
    async def design_case_study(args):
        return await _forward("design_case_study", args)

    # --- export ---

    @tool("export_lesson", "Trigger a lesson export. Confirm with the user first.", {
        "type": "object",
        "properties": {
            "lesson_id": {"type": "string"},
            "format": {"type": "string", "enum": ["scorm", "json"]},
        },
        "required": ["lesson_id", "format"],
    })
    async def export_lesson(args):
        return await _forward("export_lesson", args)

    return create_sdk_mcp_server(
        name="ui",
        version="0.1.0",
        tools=[
            navigate,
            set_brand,
            propose_course_outline,
            write_lesson,
            read_materials,
            write_script,
            write_knowledge_check,
            regenerate_question,
            design_case_study,
            list_structure,
            add_module,
            add_lesson,
            add_block,
            update_block,
            delete_block,
            reorder,
            export_lesson,
        ],
    )


ALLOWED_TOOL_NAMES = [
    "mcp__ui__navigate",
    "mcp__ui__set_brand",
    "mcp__ui__propose_course_outline",
    "mcp__ui__write_lesson",
    "mcp__ui__read_materials",
    "mcp__ui__write_script",
    "mcp__ui__write_knowledge_check",
    "mcp__ui__regenerate_question",
    "mcp__ui__design_case_study",
    "mcp__ui__list_structure",
    "mcp__ui__add_module",
    "mcp__ui__add_lesson",
    "mcp__ui__add_block",
    "mcp__ui__update_block",
    "mcp__ui__delete_block",
    "mcp__ui__reorder",
    "mcp__ui__export_lesson",
]
