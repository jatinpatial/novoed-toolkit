import asyncio
import sys

import uvicorn

if __name__ == "__main__":
    if sys.platform == "win32":
        # ProactorEventLoop is required so the claude-agent-sdk can spawn the claude CLI
        # subprocess. SelectorEventLoop raises NotImplementedError on subprocess_exec.
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    uvicorn.run(
        "agent_backend.main:app",
        host="127.0.0.1",
        port=8766,
        reload=False,
        loop="asyncio",
    )
