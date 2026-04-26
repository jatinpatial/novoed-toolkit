"""File-to-text extraction for source materials.

Each parser takes raw bytes and returns plain text. The dispatcher picks the
parser by file extension. Errors surface as ParseError with a friendly message.
"""
from __future__ import annotations

import io
import logging
import os
from typing import Callable

log = logging.getLogger(__name__)


class ParseError(Exception):
    pass


def _parse_txt(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("utf-8", errors="replace")


def _parse_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ParseError("pypdf not installed") from exc
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [p.extract_text() or "" for p in reader.pages]
        return "\n\n".join(pages).strip()
    except Exception as exc:
        raise ParseError(f"could not read PDF: {exc}") from exc


def _parse_pptx(data: bytes) -> str:
    try:
        from pptx import Presentation
    except ImportError as exc:
        raise ParseError("python-pptx not installed") from exc
    try:
        prs = Presentation(io.BytesIO(data))
        slides_out: list[str] = []
        for i, slide in enumerate(prs.slides, start=1):
            chunks = [f"Slide {i}"]
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        text = "".join(run.text for run in para.runs).strip()
                        if text:
                            chunks.append(text)
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    chunks.append(f"(Notes) {notes}")
            slides_out.append("\n".join(chunks))
        return "\n\n".join(slides_out).strip()
    except Exception as exc:
        raise ParseError(f"could not read PPTX: {exc}") from exc


def _parse_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise ParseError("python-docx not installed") from exc
    try:
        doc = Document(io.BytesIO(data))
        parts: list[str] = []
        for para in doc.paragraphs:
            if para.text.strip():
                parts.append(para.text)
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells)
                if row_text.strip(" |"):
                    parts.append(row_text)
        return "\n".join(parts).strip()
    except Exception as exc:
        raise ParseError(f"could not read DOCX: {exc}") from exc


_PARSERS: dict[str, Callable[[bytes], str]] = {
    ".txt": _parse_txt,
    ".md": _parse_txt,
    ".markdown": _parse_txt,
    ".pdf": _parse_pdf,
    ".pptx": _parse_pptx,
    ".docx": _parse_docx,
}

SUPPORTED_EXTENSIONS = sorted(_PARSERS.keys())


def parse_file(filename: str, data: bytes) -> str:
    """Extract text from a file by its extension. Raises ParseError on failure."""
    ext = os.path.splitext(filename.lower())[1]
    parser = _PARSERS.get(ext)
    if parser is None:
        raise ParseError(
            f"unsupported file type '{ext}' — supported: {', '.join(SUPPORTED_EXTENSIONS)}"
        )
    return parser(data)
