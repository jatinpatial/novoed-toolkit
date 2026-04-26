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
from .config import SYSTEM_PROMPT, TOOL_CALL_TIMEOUT_SECONDS
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

    async def _send(self, payload: dict[str, Any]) -> None:
        await self.ws.send_text(json.dumps(payload))

    async def start(self) -> None:
        ui_server = build_ui_mcp_server(self.bridge)
        options = ClaudeAgentOptions(
            system_prompt=SYSTEM_PROMPT,
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
