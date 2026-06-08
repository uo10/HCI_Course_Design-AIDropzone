"""
File-content preview helper — shared by Mock and LLM parsers.

Extracts a plain-text preview from supported text/binary files
so the parser can feed actual content (not just filenames) to
the analysis engine.

Public API:
    read_text_preview(path, max_chars=4000) → str
    is_text_file(path) → bool
"""

from __future__ import annotations

import codecs
from pathlib import Path

# Extensions we treat as plain text (readable with .read_text)
_TEXT_EXTENSIONS: set[str] = {
    "txt", "md", "csv", "log", "json", "xml", "yaml", "yml",
    "py", "js", "ts", "jsx", "tsx", "java", "cpp", "c", "h",
    "go", "rs", "rb", "php", "swift", "kt", "scala", "lua",
    "html", "css", "scss", "less", "sql", "sh", "bash", "zsh",
    "ps1", "bat", "cmd", "ini", "cfg", "toml", "env", "conf",
    "tex", "rst", "org", "r", "rmd", "ipynb", "dockerfile",
    "gitignore", "makefile", "cmake", "gradle", "lock",
}

# Known binary extensions — don't even try reading these
_BINARY_EXTENSIONS: set[str] = {
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "ico", "svg",
    "mp4", "avi", "mov", "mkv", "wmv", "flv",
    "mp3", "wav", "flac", "aac", "ogg", "wma",
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "exe", "dll", "so", "dylib", "obj", "o", "class",
    "pyc", "pyo", "pyd",
}

# UTF-8 BOM and fallback encodings to try
_FALLBACK_ENCODINGS = ["utf-8", "utf-16", "gbk", "latin-1"]


def is_text_file(path: Path) -> bool:
    """Return True if *path* is a candidate for text-content extraction."""
    ext = path.suffix.lstrip(".").lower()
    if ext in _TEXT_EXTENSIONS:
        return True
    if ext in _BINARY_EXTENSIONS:
        return False
    # Unknown extension: probe
    return _probe_is_text(path)


def _probe_is_text(path: Path) -> bool:
    """Try to read the first 512 bytes as UTF-8."""
    try:
        with open(path, "rb") as fh:
            head = fh.read(512)
        # Check for null bytes (strong binary indicator)
        if b"\x00" in head:
            return False
        head.decode("utf-8")
        return True
    except (OSError, UnicodeDecodeError):
        return False


def read_text_preview(path: Path, max_chars: int = 4000) -> str:
    """Return the first *max_chars* characters of a text file.

    Tries multiple encodings.  Returns "" for binary / unreadable files.
    """
    try:
        if not path.is_file():
            return ""
        if not is_text_file(path):
            return ""

        raw = path.read_bytes()

        # Try each encoding
        for enc in _FALLBACK_ENCODINGS:
            try:
                text = codecs.decode(raw, enc, errors="strict")
                break
            except (UnicodeDecodeError, LookupError):
                continue
        else:
            # All encodings failed — probably binary
            return ""

        # Truncate to max_chars
        if len(text) > max_chars:
            text = text[:max_chars] + "\n... (truncated)"

        return text.strip()

    except (OSError, PermissionError):
        return ""
