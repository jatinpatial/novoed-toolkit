import asyncio
import sys

if sys.platform == "win32":
    # Required so claude-agent-sdk can spawn the claude CLI subprocess.
    # SelectorEventLoop raises NotImplementedError on subprocess_exec.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
