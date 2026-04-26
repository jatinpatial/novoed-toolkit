"""Smoke-test: pretend to be the FE. Connects to /ws, sends a message, prints events.

Usage: python scripts/ws_smoke.py
"""
import asyncio
import json
import sys

import websockets


async def main():
    uri = "ws://127.0.0.1:8766/ws"
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Say hi in one sentence. Do NOT call any tools."

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "user_message", "text": prompt}))
        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            mtype = msg.get("type")
            if mtype == "assistant_text":
                print(f"[assistant] {msg['text']}")
            elif mtype == "tool_call":
                print(f"[tool_call] {msg['name']} args={msg['args']}  id={msg['id']}")
                # fake a successful FE result so the agent can continue
                await ws.send(json.dumps({
                    "type": "tool_result",
                    "id": msg["id"],
                    "ok": True,
                    "result": {"stub": True},
                }))
            elif mtype == "error":
                print(f"[error] {msg['message']}")
                break
            elif mtype == "done":
                print(f"[done] usage={msg.get('usage')}")
                break


if __name__ == "__main__":
    asyncio.run(main())
