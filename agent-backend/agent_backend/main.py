import io
import logging
import re

from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from docx import Document
from docx.shared import Cm, Pt, RGBColor

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


class ScriptExportRequest(BaseModel):
    script: str
    videoType: str = "speaker"
    lessonRef: str = ""
    courseName: str = ""
    duration: str = ""


# BCG green for section headers / accents in the exported .docx.
_BCG_GREEN = RGBColor(0x1B, 0x7A, 0x4F)
_BCG_INK = RGBColor(0x33, 0x33, 0x33)
_BCG_INK_LT = RGBColor(0x66, 0x66, 0x66)


def _parse_scenes(script: str) -> list[dict]:
    """Mirror of the FE parser. Returns a list of {index, spoken, visual}."""
    if not script.strip():
        return []
    if not re.search(r"SCENE\s+\d+", script, re.I):
        return []
    if not re.search(r"(SPOKEN|VISUAL):", script, re.I):
        return []

    scenes: list[dict] = []
    current: dict | None = None
    field: str | None = None
    for line in script.splitlines():
        m = re.match(r"^\s*SCENE\s+(\d+)", line, re.I)
        if m:
            if current:
                scenes.append(current)
            current = {"index": int(m.group(1)), "spoken": "", "visual": ""}
            field = None
            continue
        if not current:
            continue
        m = re.match(r"^\s*SPOKEN:\s*(.*)$", line, re.I)
        if m:
            field = "spoken"
            current["spoken"] = m.group(1)
            continue
        m = re.match(r"^\s*VISUAL:\s*(.*)$", line, re.I)
        if m:
            field = "visual"
            current["visual"] = m.group(1)
            continue
        if field and line.strip():
            sep = "\n" if current[field] else ""
            current[field] = current[field] + sep + line.strip()
    if current:
        scenes.append(current)
    return scenes


def _count_spoken_words(script: str) -> int:
    """Count words across all SPOKEN: blocks, stripping XML-ish tags."""
    matches = re.findall(
        r"SPOKEN:\s*([\s\S]*?)(?=\n\s*(?:VISUAL:|SCENE\s+\d+|$))",
        script,
        re.I,
    )
    spoken = " ".join(matches)
    cleaned = re.sub(r"<[^>]*>", "", spoken).strip()
    if not cleaned:
        return 0
    return len(re.split(r"\s+", cleaned))


def _safe_filename(stem: str) -> str:
    cleaned = re.sub(r"[^\w\-_.]", "_", stem).strip("_") or "script"
    return cleaned[:80]


@app.post("/export/script-docx")
async def export_script_docx(req: ScriptExportRequest):
    if not req.script or not req.script.strip():
        raise HTTPException(status_code=400, detail="script is required")

    scenes = _parse_scenes(req.script)
    word_count = _count_spoken_words(req.script)
    seconds = round(word_count / 150 * 60) if word_count else 0

    doc = Document()

    # Title — course name
    title = doc.add_paragraph()
    run = title.add_run(req.courseName or "Synthesia Script")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = _BCG_GREEN

    # Subtitle — lesson / type / duration
    sub_bits = []
    if req.lessonRef:
        sub_bits.append(f"Lesson {req.lessonRef}")
    if req.videoType:
        sub_bits.append(req.videoType.capitalize())
    if req.duration:
        sub_bits.append(req.duration)
    if sub_bits:
        sub = doc.add_paragraph()
        run = sub.add_run(" · ".join(sub_bits))
        run.font.size = Pt(11)
        run.font.color.rgb = _BCG_INK_LT

    doc.add_paragraph()  # spacer

    if scenes:
        # Section header for the table
        header = doc.add_paragraph()
        run = header.add_run("Scenes")
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = _BCG_GREEN

        table = doc.add_table(rows=1, cols=3)
        table.style = "Light Grid Accent 1"
        # Header row
        hdr_cells = table.rows[0].cells
        for i, label in enumerate(["#", "Spoken", "Visual"]):
            cell = hdr_cells[i]
            p = cell.paragraphs[0]
            r = p.add_run(label)
            r.bold = True
            r.font.size = Pt(10)
            r.font.color.rgb = _BCG_GREEN

        # Approximate column widths.
        widths_cm = (1.0, 9.0, 6.0)
        for col_idx, w in enumerate(widths_cm):
            for cell in table.columns[col_idx].cells:
                cell.width = Cm(w)

        for s in scenes:
            row = table.add_row().cells
            # # (scene number)
            p = row[0].paragraphs[0]
            r = p.add_run(str(s["index"]))
            r.bold = True
            r.font.size = Pt(10)
            r.font.color.rgb = _BCG_INK
            # Spoken — monospace for readability
            p = row[1].paragraphs[0]
            r = p.add_run(s["spoken"])
            r.font.name = "Consolas"
            r.font.size = Pt(10)
            r.font.color.rgb = _BCG_INK
            # Visual
            p = row[2].paragraphs[0]
            r = p.add_run(s["visual"])
            r.font.size = Pt(10)
            r.font.color.rgb = _BCG_INK_LT
    else:
        # Fallback — script didn't parse as scenes; embed raw.
        header = doc.add_paragraph()
        run = header.add_run("Script (raw — couldn't parse as scenes)")
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = _BCG_GREEN

        body = doc.add_paragraph()
        run = body.add_run(req.script)
        run.font.name = "Consolas"
        run.font.size = Pt(10)

    # Footer — word count + duration estimate
    doc.add_paragraph()
    foot = doc.add_paragraph()
    run = foot.add_run(f"~{word_count} words · ~{seconds} sec at 150 wpm")
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = _BCG_INK_LT

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    stem = _safe_filename(f"{req.courseName}-{req.lessonRef}-script") if req.courseName else _safe_filename(f"{req.lessonRef}-script")
    filename = f"{stem}.docx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
