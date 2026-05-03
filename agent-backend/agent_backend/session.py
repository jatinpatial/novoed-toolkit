import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
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


# polish-13a: module-level singletons. Bridge + orchestrator persist
# across WebSocket reconnects so a build started in one WS keeps
# running and reattaches to the next WS without a halt.
#
# Trigger that motivated this: an FE refresh mid-build (Vite HMR,
# manual reload, network blip) tore down the WS while the orchestrator
# was actively writing lessons. Pre-fix:
#   - The orchestrator's _send pointed at the dead WS.
#   - Starlette raised RuntimeError("Unexpected ASGI message...")
#     on the next state-event send.
#   - The asyncio task carrying the build crashed silently.
#   - The new WS connected to a fresh per-session orchestrator with
#     empty state, so the FE saw idle while the OLD orchestrator was
#     either crashed or trying to talk to a dead pipe.
#
# Per-LD localhost = single user per backend instance, so a
# module-level singleton is the right abstraction. If we ever go
# multi-user (Phase 3 / Electron), this becomes a registry keyed
# by session token.
_shared_bridge: ToolBridge | None = None
_shared_orchestrator: BuildOrchestrator | None = None


class Session:
    """One WebSocket connection ↔ one ClaudeSDKClient. Multi-turn
    conversation state lives in the SDK.

    polish-13a: the bridge + orchestrator are SHARED across Session
    instances (module-level singletons). Each new Session:
      1. Binds the bridge's sender to its own WS-write
      2. Swaps the orchestrator's sender to its own WS-write
      3. Creates a fresh chat-side ClaudeSDKClient (chat IS per-WS)

    Builds-in-flight survive reconnects via the singletons. Pending
    tool_call futures on the bridge are NOT cancelled on Session
    close — stalled calls (sent to the now-dead WS, FE never replied)
    time out and trigger the orchestrator's retry path, which sends
    them through the NEW WS via the updated bind_sender target.
    """

    def __init__(self, websocket: WebSocket):
        global _shared_bridge, _shared_orchestrator
        self.ws = websocket

        # Reuse the bridge across reconnects so pending tool-call
        # futures survive. Timeout-based recovery handles stalled
        # calls (the orchestrator's retry path takes care of them).
        if _shared_bridge is None:
            _shared_bridge = ToolBridge(timeout_seconds=TOOL_CALL_TIMEOUT_SECONDS)
        self.bridge = _shared_bridge
        # ALWAYS re-bind the sender to THIS session's WS. Every reconnect
        # gets a fresh send target — old WS references go stale.
        self.bridge.bind_sender(self._send)

        # sprint-2-1: orchestrator gets the SAME bridge as the main
        # session. ToolBridge call_ids are global UUIDs so tool_result
        # routing-by-id Just Works.
        # sprint-2-3: locked fork #2 — same bridge means write_lesson /
        # list_structure / etc. from mini-sessions hit the same FE-side
        # AgentActions as the manual chat path.
        # polish-13a: orchestrator is also a singleton — reuse if a
        # build is already in flight, just swap its sender to the new
        # WS. New WS = same build, new pipe.
        if _shared_orchestrator is None:
            _shared_orchestrator = BuildOrchestrator(send=self._send, bridge=self.bridge)
        else:
            _shared_orchestrator.update_sender(self._send)
        self.orchestrator = _shared_orchestrator

        self._client: ClaudeSDKClient | None = None
        self._lock = asyncio.Lock()  # one chat turn at a time

    async def _send(self, payload: dict[str, Any]) -> None:
        """polish-13a: defensive — WS may have closed mid-build (HMR
        reload, manual refresh, network blip). Log & continue silently
        instead of crashing the asyncio task. The FE rehydrates via
        get_orchestrator_state on reconnect (sprint-2-1 wired this),
        so missed state events are recoverable.
        """
        try:
            await self.ws.send_text(json.dumps(payload))
        except (RuntimeError, WebSocketDisconnect) as exc:
            # RuntimeError covers Starlette's "Unexpected ASGI message
            # 'websocket.send', after sending 'websocket.close'…"
            # WebSocketDisconnect can land on send paths in some
            # transport states.
            log.warning("ws send dropped (closed): %s", type(exc).__name__)
        except Exception as exc:
            # Catch-all so a transient transport issue can't crash the
            # build's asyncio task. Includes connection errors that
            # don't subclass the two above on different ASGI servers.
            log.warning("ws send unexpected error: %s", exc, exc_info=True)

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
        # polish-13a: do NOT tear down the shared bridge or orchestrator
        # on session close. They survive reconnects so a build started
        # in one WS keeps running and reattaches to the next WS.
        #
        # Pre-fix this called self.bridge.cancel_all("session closed")
        # which cancelled every pending tool_call future, including
        # those owned by an in-flight build. With the singleton bridge,
        # cancelling on per-session close would break recovery —
        # so it's removed. Stalled futures (sent to the now-dead WS,
        # never resolved) time out via TOOL_CALL_TIMEOUT_SECONDS and
        # trip the orchestrator's retry path; the retry sends through
        # the new WS via bind_sender's updated target.
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception:
                pass
