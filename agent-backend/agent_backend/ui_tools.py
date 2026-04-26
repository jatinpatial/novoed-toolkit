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
    "mcp__ui__list_structure",
    "mcp__ui__add_module",
    "mcp__ui__add_lesson",
    "mcp__ui__add_block",
    "mcp__ui__update_block",
    "mcp__ui__delete_block",
    "mcp__ui__reorder",
    "mcp__ui__export_lesson",
]
