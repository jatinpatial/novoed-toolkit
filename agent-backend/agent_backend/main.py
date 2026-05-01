import logging

from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config  # noqa: F401 — loads .env and sets git-bash env var on import
from .exports import router as exports_router
from .parse import ParseError, SUPPORTED_EXTENSIONS, parse_file
from .session import Session

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB hard cap per file

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="NovoEd Course Builder Agent Backend")

app.add_middleware(
    CORSMiddleware,
    # Multi-origin allowlist — supports both the local Vite dev
    # server and the GitHub Pages production deploy (per
    # config.py's ALLOWED_ORIGINS). Override via the
    # ALLOWED_ORIGINS env var (comma-separated). The /ws WebSocket
    # endpoint sidesteps CORS at the protocol level so it works
    # from any origin browsers permit (modern browsers allow
    # https-page -> ws://localhost via the localhost exception
    # to mixed-content rules).
    allow_origins=config.ALLOWED_ORIGINS,
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


# Word-document exporters — script, case study, and (Phase 1 #6) the
# whole-course bundle. Routes live in agent_backend/exports.py so this
# file stays focused on FastAPI plumbing + the WebSocket session.
app.include_router(exports_router)


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
