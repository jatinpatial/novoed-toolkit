import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config  # noqa: F401 — loads .env and sets git-bash env var on import
from .session import Session

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="NovoEd Course Builder Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    session = Session(websocket)
    try:
        await session.start()
        while True:
            raw = await websocket.receive_text()
            await session.handle_client_message(raw)
    except WebSocketDisconnect:
        log.info("client disconnected")
    except Exception:
        log.exception("ws session error")
    finally:
        await session.close()
