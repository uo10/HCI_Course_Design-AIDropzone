"""
Tag Index — decouples tags from filenames.

Maintains a `tags_index.json` file in the workspace root that maps
filename → list of tags.  This avoids MAX_PATH issues caused by
embedding tags inside filenames.

Public API:
    load_index(workspace)       → dict[str, list[str]]
    save_index(workspace, data) → None
    set_tags(workspace, filename, tags) → None
    get_tags(workspace, filename) → list[str]
    find_by_tags(workspace, tags) → list[Path]
    all_tags(workspace) → set[str]
    rescan_index(workspace) → int  (returns # newly indexed files)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

INDEX_FILENAME = "tags_index.json"

# Files that should never appear in the tag index or be exported
_SKIP_FILENAMES: set[str] = {
    INDEX_FILENAME,
    INDEX_FILENAME + ".tmp",
    "manifest.json",
    "rollback_log.json",
    ".aidropzone_write_test",
}

# Heuristic tag extraction patterns for auto-indexing unregistered files
_RE_HASH = re.compile(r"^[a-f0-9]{8,}$")
_RE_DATE = re.compile(r"^\d{8}$")

# Known tag-like tokens that our Mock AI scenario engine produces + category fallbacks
_KNOWN_TAGS: set[str] = {
    "coursework", "assignment", "job", "career", "finance", "proof",
    "document", "text", "image", "media", "video", "audio",
    "archive", "compressed", "code", "spreadsheet", "data",
    "presentation", "slides", "pdf", "photo", "screenshot",
    "draft", "readme", "note", "report", "sensitive",
}


# ---------------------------------------------------------------------------
# Low-level read / write
# ---------------------------------------------------------------------------

def _index_path(workspace: Path) -> Path:
    return workspace / INDEX_FILENAME


def load_index(workspace: Path) -> dict[str, list[str]]:
    """Read the tag index from disk.  Returns {} if missing or corrupt."""
    try:
        path = _index_path(workspace)
        if not path.is_file():
            return {}
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return {}


def save_index(workspace: Path, data: dict[str, list[str]]) -> None:
    """Atomically overwrite the tag index file."""
    path = _index_path(workspace)
    tmp = path.with_suffix(".tmp")
    workspace.mkdir(parents=True, exist_ok=True)
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(path)


# ---------------------------------------------------------------------------
# Per-entry operations
# ---------------------------------------------------------------------------

def set_tags(workspace: Path, filename: str, tags: list[str]) -> None:
    """Associate *tags* with *filename* in the index.  Overwrites any
    previous entry for the same filename."""
    data = load_index(workspace)
    data[filename] = sorted(set(tags))
    save_index(workspace, data)


def get_tags(workspace: Path, filename: str) -> list[str]:
    """Return the tags for *filename*, or [] if not found."""
    data = load_index(workspace)
    return data.get(filename, [])


# ---------------------------------------------------------------------------
# Auto-discovery: scan workspace for files not yet in the index
# ---------------------------------------------------------------------------

def _extract_tags_from_filename(filename: str) -> set[str]:
    """Heuristically extract tag-like tokens from a filename stem."""
    stem = Path(filename).stem
    tokens: set[str] = set()
    for part in stem.split("_"):
        low = part.lower()
        if not low or _RE_HASH.match(low) or _RE_DATE.match(low):
            continue
        if len(low) <= 20 and low in _KNOWN_TAGS:
            tokens.add(low)
    # Ensure minimum: every file gets at least "file"
    if not tokens:
        tokens.add("file")
    return tokens


def rescan_index(workspace: Path) -> int:
    """Scan workspace for regular files not yet in the tag index, and
    auto-assign heuristic tags to them.

    Existing index entries are preserved (never overwritten).

    Returns the number of newly indexed files.
    """
    data = load_index(workspace)
    added = 0

    try:
        for entry in workspace.iterdir():
            if not entry.is_file():
                continue
            name = entry.name
            if name in _SKIP_FILENAMES:
                continue
            if name not in data:
                data[name] = sorted(_extract_tags_from_filename(name))
                added += 1
    except OSError:
        pass

    if added:
        save_index(workspace, data)

    return added


# ---------------------------------------------------------------------------
# Query helpers (used by exporter)
# ---------------------------------------------------------------------------

def find_by_tags(workspace: Path, tags: set[str]) -> list[Path]:
    """Return workspace files that have ALL requested tags (AND semantics).

    Before querying, runs a rescan to pick up any files that were placed
    in the workspace without going through /rename.  Stale entries are
    automatically cleaned.
    """
    # Auto-discover unindexed files first
    rescan_index(workspace)

    data = load_index(workspace)
    tag_list = sorted(tags)
    if not tag_list:
        return []

    matched: list[Path] = []
    stale: list[str] = []

    for filename, file_tags in data.items():
        if set(tag_list).issubset(set(file_tags)):
            fpath = (workspace / filename).resolve()
            if fpath.is_file():
                matched.append(fpath)
            else:
                stale.append(filename)

    # Housekeeping: remove stale entries
    if stale:
        for fn in stale:
            data.pop(fn, None)
        save_index(workspace, data)

    return sorted(matched)


def all_tags(workspace: Path) -> set[str]:
    """Return the union of all tags present in the index (the full tag library)."""
    # Auto-discover unindexed files first
    rescan_index(workspace)

    data = load_index(workspace)
    result: set[str] = set()
    for file_tags in data.values():
        result.update(file_tags)
    return result
