import asyncio
import uuid
from typing import Any


class ToolBridge:
    """Reconciles in-process MCP tool calls with FE-provided results over WebSocket.

    The agent calls a Python tool function. That function registers a Future keyed by a
    fresh call id, pushes a `tool_call` event to the FE over WebSocket, then awaits the
    Future. When the FE replies with `tool_result`, the session resolves the Future.
    """

    def __init__(self, timeout_seconds: float):
        self._timeout = timeout_seconds
        self._pending: dict[str, asyncio.Future[Any]] = {}
        self._send_to_fe: callable | None = None

    def bind_sender(self, send_to_fe) -> None:
        self._send_to_fe = send_to_fe

    async def call(self, name: str, args: dict[str, Any]) -> Any:
        if self._send_to_fe is None:
            raise RuntimeError("ToolBridge has no FE sender bound")

        call_id = uuid.uuid4().hex
        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        self._pending[call_id] = future

        try:
            await self._send_to_fe({
                "type": "tool_call",
                "id": call_id,
                "name": name,
                "args": args,
            })
            return await asyncio.wait_for(future, timeout=self._timeout)
        finally:
            self._pending.pop(call_id, None)

    def resolve(self, call_id: str, ok: bool, result: Any, error: str | None) -> None:
        future = self._pending.get(call_id)
        if future is None or future.done():
            return
        if ok:
            future.set_result(result)
        else:
            future.set_exception(RuntimeError(error or "tool call failed on client"))

    def cancel_all(self, reason: str = "session closed") -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(RuntimeError(reason))
        self._pending.clear()
