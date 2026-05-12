"""
Mock AI Parser — deterministic rule-based file classification.

Implements the AIParserInterface contract from CLAUDE.md.
Does NOT call any external API. All results are computed from file metadata.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from pathlib import Path

from ..models.common import FileCategory, FileMetadata, OperationStatus
from ..models.parser import ParseItem, ParseResult


# ---------------------------------------------------------------------------
# Rule tables
# ---------------------------------------------------------------------------

EXTENSION_CATEGORY: dict[str, FileCategory] = {
    # Documents
    "doc": FileCategory.DOCUMENT, "docx": FileCategory.DOCUMENT,
    "txt": FileCategory.DOCUMENT, "md": FileCategory.DOCUMENT,
    "rtf": FileCategory.DOCUMENT, "odt": FileCategory.DOCUMENT,
    # Images
    "png": FileCategory.IMAGE, "jpg": FileCategory.IMAGE,
    "jpeg": FileCategory.IMAGE, "gif": FileCategory.IMAGE,
    "bmp": FileCategory.IMAGE, "webp": FileCategory.IMAGE,
    "svg": FileCategory.IMAGE, "ico": FileCategory.IMAGE,
    # Video
    "mp4": FileCategory.VIDEO, "avi": FileCategory.VIDEO,
    "mov": FileCategory.VIDEO, "mkv": FileCategory.VIDEO,
    "wmv": FileCategory.VIDEO, "flv": FileCategory.VIDEO,
    # Audio
    "mp3": FileCategory.AUDIO, "wav": FileCategory.AUDIO,
    "flac": FileCategory.AUDIO, "aac": FileCategory.AUDIO,
    "ogg": FileCategory.AUDIO, "wma": FileCategory.AUDIO,
    # Archives
    "zip": FileCategory.ARCHIVE, "rar": FileCategory.ARCHIVE,
    "7z": FileCategory.ARCHIVE, "tar": FileCategory.ARCHIVE,
    "gz": FileCategory.ARCHIVE, "bz2": FileCategory.ARCHIVE,
    # Code
    "py": FileCategory.CODE, "js": FileCategory.CODE,
    "ts": FileCategory.CODE, "java": FileCategory.CODE,
    "cpp": FileCategory.CODE, "c": FileCategory.CODE,
    "go": FileCategory.CODE, "rs": FileCategory.CODE,
    "html": FileCategory.CODE, "css": FileCategory.CODE,
    "json": FileCategory.CODE, "xml": FileCategory.CODE,
    "yaml": FileCategory.CODE, "yml": FileCategory.CODE,
    # Spreadsheets
    "xls": FileCategory.SPREADSHEET, "xlsx": FileCategory.SPREADSHEET,
    "csv": FileCategory.SPREADSHEET,
    # Presentations
    "ppt": FileCategory.PRESENTATION, "pptx": FileCategory.PRESENTATION,
    # PDF
    "pdf": FileCategory.PDF,
}

CATEGORY_DEFAULT_TAGS: dict[FileCategory, set[str]] = {
    FileCategory.DOCUMENT: {"document", "text"},
    FileCategory.IMAGE: {"image", "media"},
    FileCategory.VIDEO: {"video", "media"},
    FileCategory.AUDIO: {"audio", "media"},
    FileCategory.ARCHIVE: {"archive", "compressed"},
    FileCategory.CODE: {"code", "text"},
    FileCategory.SPREADSHEET: {"spreadsheet", "data"},
    FileCategory.PRESENTATION: {"presentation", "slides"},
    FileCategory.PDF: {"pdf", "document"},
    FileCategory.UNKNOWN: {"unknown"},
}

CATEGORY_SUMMARIES: dict[FileCategory, str] = {
    FileCategory.DOCUMENT: "A structured text document containing written content.",
    FileCategory.IMAGE: "A raster or vector image file.",
    FileCategory.VIDEO: "A video recording or animation clip.",
    FileCategory.AUDIO: "An audio recording or sound file.",
    FileCategory.ARCHIVE: "A compressed archive containing bundled files.",
    FileCategory.CODE: "A source code file or structured data format.",
    FileCategory.SPREADSHEET: "A tabular data spreadsheet.",
    FileCategory.PRESENTATION: "A slide-based presentation file.",
    FileCategory.PDF: "A Portable Document Format file suitable for sharing.",
    FileCategory.UNKNOWN: "An unrecognized or unsupported file type.",
}

KEYWORD_PATTERNS: dict[str, re.Pattern] = {
    "screenshot": re.compile(r"screenshot|screen|capture|snip", re.IGNORECASE),
    "photo": re.compile(r"photo|pic|image|img|dsc", re.IGNORECASE),
    "paper": re.compile(r"paper|thesis|dissertation|manuscript", re.IGNORECASE),
    "report": re.compile(r"report|annual|quarterly", re.IGNORECASE),
    "slide": re.compile(r"slide|deck|presentation|lecture", re.IGNORECASE),
    "data": re.compile(r"data|dataset|export|dump", re.IGNORECASE),
    "backup": re.compile(r"backup|snapshot|archive", re.IGNORECASE),
    "config": re.compile(r"config|conf|setting|env|rc", re.IGNORECASE),
    "note": re.compile(r"note|memo|draft|todo", re.IGNORECASE),
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_file(file_meta: FileMetadata) -> ParseResult:
    """Parse a single file — mock implementation.

    Returns:
        ParseResult with status=SUCCESS and a ParseItem on success,
        or status=FAILURE and an error message on failure.
    """
    try:
        ext = file_meta.extension.lower().lstrip(".")
        category = EXTENSION_CATEGORY.get(ext, FileCategory.UNKNOWN)
        tags = set(CATEGORY_DEFAULT_TAGS.get(category, {"unknown"}))
        summary = CATEGORY_SUMMARIES.get(category, "Unknown file type.")

        # Add inferred keywords from filename
        keywords: list[str] = []
        name_lower = file_meta.name_before_drop.lower()
        for kw, pattern in KEYWORD_PATTERNS.items():
            if pattern.search(name_lower):
                keywords.append(kw)
                tags.add(kw)

        # Compute a short content hash stub
        hash_input = f"{file_meta.path}:{file_meta.size_bytes}"
        sha = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:8]

        # Suggest a new name while preserving the original extension
        stem = Path(file_meta.name_before_drop).stem
        primary_tag = sorted(tags)[0] if tags else "file"
        suggested_name = f"{primary_tag}_{sha}_{stem}.{ext}"

        item = ParseItem(
            file_path=file_meta.path,
            suggested_name=suggested_name,
            category=category,
            tags=tags,
            summary=summary,
            keywords=keywords,
            confidence=0.85,
            parsed_at=datetime.utcnow(),
        )

        return ParseResult(status=OperationStatus.SUCCESS, data=item)

    except Exception as e:
        return ParseResult(status=OperationStatus.FAILURE, error=str(e))
