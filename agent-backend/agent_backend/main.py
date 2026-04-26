import logging

from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config  # noqa: F401 — loads .env and sets git-bash env var on import
from .parse import ParseError, SUPPORTED_EXTENSIONS, parse_file
from .session import Session

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB hard cap per file

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


@app.post("/parse")
async def parse_endpoint(file: UploadFile):
    filename = file.filename or "upload"
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large: {len(data) // 1024} KB exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB cap",
        )
    try:
        text = parse_file(filename, data)
    except ParseError as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    return {
        "filename": filename,
        "text": text,
        "charCount": len(text),
        "supported": SUPPORTED_EXTENSIONS,
    }


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
