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
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional


INDEX_FILENAME = "tags_index.json"


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
# Query helpers (used by exporter)
# ---------------------------------------------------------------------------

def find_by_tags(workspace: Path, tags: set[str]) -> list[Path]:
    """Return workspace files that have ALL requested tags (AND semantics).

    Only returns files that actually exist on disk — stale entries are
    automatically cleaned from the index.
    """
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
    data = load_index(workspace)
    result: set[str] = set()
    for file_tags in data.values():
        result.update(file_tags)
    return result
