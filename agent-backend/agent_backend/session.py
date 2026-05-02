import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
)

from .bridge import ToolBridge
from .config import SYSTEM_PROMPT_FILE, TOOL_CALL_TIMEOUT_SECONDS
from .orchestrator import BuildOrchestrator
from .ui_tools import ALLOWED_TOOL_NAMES, build_ui_mcp_server

log = logging.getLogger(__name__)


class Session:
    """One WebSocket connection ↔ one ClaudeSDKClient. Multi-turn conversation state lives in the SDK."""

    def __init__(self, websocket: WebSocket):
        self.ws = websocket
        self.bridge = ToolBridge(timeout_seconds=TOOL_CALL_TIMEOUT_SECONDS)
        self.bridge.bind_sender(self._send)
        self._client: ClaudeSDKClient | None = None
        self._lock = asyncio.Lock()  # one turn at a time
        # sprint-2-1: per-session orchestrator. Owns its own asyncio.Lock
        # internally so build coroutines don't contend with self._lock —
        # chat stays responsive during a build (locked fork #3, independent
        # queues). Orchestrator messages are routed via asyncio.create_task
        # below so they fan out from the chat router.
        self.orchestrator = BuildOrchestrator(send=self._send)

    async def _send(self, payload: dict[str, Any]) -> None:
        await self.ws.send_text(json.dumps(payload))

    async def start(self) -> None:
        ui_server = build_ui_mcp_server(self.bridge)
        # urgent-fix-prompt-size: pass the system prompt as a FILE rather
        # than a string. Pre-fix the SDK was stuffing the full 34 KB
        # prompt onto the CLI subprocess command line, which exceeded
        # the Windows CreateProcess 32,767-char limit and the agent
        # couldn't spawn. The {"type": "file", "path": ...} dict form
        # tells the SDK to use --system-prompt-file <path> instead;
        # subprocess args drop to a few hundred bytes regardless of
        # prompt size. See config.py for the file-write logic.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": ui_server},
            allowed_tools=ALLOWED_TOOL_NAMES,
        )
        self._client = ClaudeSDKClient(options=options)
        await self._client.connect()

    async def handle_client_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await self._send({"type": "error", "message": "malformed json"})
            return

        mtype = msg.get("type")
        if mtype == "tool_result":
            self.bridge.resolve(
                call_id=msg.get("id", ""),
                ok=bool(msg.get("ok", True)),
                result=msg.get("result"),
                error=msg.get("error"),
            )
        elif mtype == "user_message":
            text = msg.get("text", "")
            asyncio.create_task(self._run_turn(text))
        elif mtype == "cancel":
            # best-effort: not a hard interrupt of the SDK, but frees pending tool calls
            self.bridge.cancel_all(reason="user canceled")
        # ─── sprint-2-1: orchestrator routes ───────────────────────────
        # Each orchestrator method is dispatched on its own task so the
        # chat router doesn't block on a long-running build. The
        # orchestrator owns an internal lock that serializes its own
        # methods (per locked fork #3 — chat and orchestrator queues
        # stay independent).
        elif mtype == "build_full_course":
            course = msg.get("course") or {}
            shape = msg.get("shape")
            asyncio.create_task(self.orchestrator.build_full_course(course, shape))
        elif mtype == "build_full_course_resume":
            try:
                start_from = int(msg.get("startFrom", 0))
            except (TypeError, ValueError):
                start_from = 0
            asyncio.create_task(self.orchestrator.resume(start_from))
        elif mtype == "build_cancel":
            asyncio.create_task(self.orchestrator.cancel())
        elif mtype == "get_orchestrator_state":
            # Not async-heavy — but we still await rather than create_task
            # so the response lands in send-order with any other state
            # changes that might be in flight. Used by the FE for
            # rehydration after a refresh (single source of truth lives
            # backend-side per locked fork #3).
            state = await self.orchestrator.get_state()
            await self._send({"type": "build_state", "state": state})
        else:
            await self._send({"type": "error", "message": f"unknown type: {mtype}"})

    async def _run_turn(self, user_text: str) -> None:
        if self._client is None:
            await self._send({"type": "error", "message": "session not started"})
            return

        async with self._lock:
            try:
                await self._client.query(user_text)
                async for event in self._client.receive_response():
                    if isinstance(event, AssistantMessage):
                        for block in event.content:
                            if isinstance(block, TextBlock) and block.text:
                                await self._send({
                                    "type": "assistant_text",
                                    "text": block.text,
                                })
                    elif isinstance(event, ResultMessage):
                        await self._send({
                            "type": "done",
                            "usage": event.usage,
                        })
                        break
            except Exception as exc:
                log.exception("turn failed")
                await self._send({"type": "error", "message": str(exc)})

    async def close(self) -> None:
        self.bridge.cancel_all("session closed")
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception:
                pass
