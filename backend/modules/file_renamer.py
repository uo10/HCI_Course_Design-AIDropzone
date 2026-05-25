"""
File Rename Executor — the physical file-operation module.

Public API:
    rename_files(request) -> RenameResult

Rules (per CLAUDE.md):
    - Every rename NOT in dry-run mode records a rollback entry FIRST.
    - When dry_run=False, files are moved **across directories** into the
      workspace root (整理篮).  This means the source file is physically
      relocated — no copy is left behind.  This is the core "桌面清理" action.
    - All paths handled via pathlib.
    - Every public function returns a structured Pydantic result.
"""

from __future__ import annotations

import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.common import OperationStatus
from ..models.renamer import (
    NamingSchema,
    RenameItem,
    RenameMode,
    RenameRequest,
    RenameResult,
)
from ..models.rollback import OperationType, RollbackEntry
from ..utils.config import get_workspace_root
from .rollback import record_operation
from .tag_index import set_tags as index_set_tags


def rename_files(request: RenameRequest) -> RenameResult:
    """Execute a batch file-rename operation.

    dry_run=True  → compute target paths, return preview, no disk writes.
    dry_run=False → record rollback entry per file, then **move** (not copy)
                     each file into the active workspace root directory.
    """
    try:
        schema = request.naming
        now = datetime.utcnow()
        preview = request.dry_run
        workspace = get_workspace_root()

        renamed: list[dict] = []
        skipped: list[dict] = []
        errors: list[dict] = []

        # Pre-validate: build target plans for all items
        plans: list[dict] = []
        for item in request.items:
            try:
                plans.append(_build_plan(item, schema, now, workspace, request.conflict_mode))
            except Exception as exc:
                errors.append({"path": item.source_path, "error": str(exc)})

        if not plans:
            return RenameResult(
                status=OperationStatus.FAILURE if errors else OperationStatus.SUCCESS,
                dry_run=preview,
                errors=errors,
                timestamp=now,
            )

        for plan in plans:
            item: RenameItem = plan["item"]
            src = plan["source"]
            dst = plan["target"]
            tags = list(item.tags_applied)

            if plan.get("skip_reason"):
                skipped.append({"path": str(src), "reason": plan["skip_reason"]})
                continue

            if preview:
                # ---- DRY RUN: preview only, no disk touches ----
                renamed.append({
                    "old": str(src),
                    "new": str(dst),
                    "tags": tags,
                })
                continue

            # ---- REAL EXECUTION: cross-directory move into workspace ----
            try:
                _execute_single(src, dst, tags)
                renamed.append({
                    "old": str(src),
                    "new": str(dst),
                    "tags": tags,
                })
            except Exception as exc:
                errors.append({"path": str(src), "error": str(exc)})

        overall = OperationStatus.SUCCESS if not errors else OperationStatus.FAILURE
        return RenameResult(
            status=overall,
            dry_run=preview,
            renamed=renamed,
            skipped=skipped,
            errors=errors,
            timestamp=now,
        )

    except Exception as exc:
        return RenameResult(
            status=OperationStatus.FAILURE,
            errors=[{"path": None, "error": str(exc)}],
        )


# ---------------------------------------------------------------------------
# Plan construction (dry-run safe — computes paths, does not touch disk)
# ---------------------------------------------------------------------------

def _build_plan(
    item: RenameItem,
    schema: NamingSchema,
    timestamp: datetime,
    workspace: Path,
    conflict_mode: RenameMode,
) -> dict:
    """Resolve source/target paths and handle conflicts.

    The destination is always *inside* the workspace root directory
    (cross-directory move).  Returns a plan dict or raises if the source
    file does not exist at all.
    """
    src = Path(item.source_path).resolve()
    if not src.is_file():
        raise FileNotFoundError(f"Source file not found: {src}")

    new_filename = _render_filename(item, schema, timestamp)
    dst = (workspace / new_filename).resolve()

    # Conflict detection (within the workspace target)
    if dst.exists() and not dst.samefile(src):
        if conflict_mode == RenameMode.SKIP:
            return {"item": item, "source": src, "target": dst, "skip_reason": "target_exists"}
        elif conflict_mode == RenameMode.AUTO_INCREMENT:
            dst = _auto_increment(dst)
        # OVERWRITE falls through — we'll overwrite the destination

    return {"item": item, "source": src, "target": dst}


# ---------------------------------------------------------------------------
# Filename generation
# ---------------------------------------------------------------------------

def _render_filename(
    item: RenameItem,
    schema: NamingSchema,
    timestamp: datetime,
) -> str:
    """Build the final filename from schema.pattern placeholders.

    Placeholders:
        {tag}  — primary tag from tags_applied (first alphabetically)
        {date} — YYYYMMDD
        {hash} — SHA-256 of file contents, first 8 hex chars
        {name} — stem of item.new_name (or source stem if empty)
        {ext}  — extension without leading dot
    """
    src = Path(item.source_path)
    ext = src.suffix.lstrip(".").lower() or "unknown"
    stem = Path(item.new_name).stem if item.new_name else src.stem

    primary_tag = (
        sorted(item.tags_applied)[0]
        if item.tags_applied
        else "untagged"
    )

    file_hash = _compute_file_hash(src)[:8]
    date_str = timestamp.strftime("%Y%m%d")

    replacements = {
        "tag": primary_tag,
        "date": date_str,
        "hash": file_hash,
        "name": stem,
        "ext": ext,
    }

    result = schema.pattern
    for key, val in replacements.items():
        result = result.replace(f"{{{key}}}", val)

    # Apply case transform
    if schema.case == "lower":
        result = result.lower()
    elif schema.case == "upper":
        result = result.upper()
    # "preserve" → no-op

    # Sanitize: replace any remaining invalid filename chars with separator
    invalid = '<>:"/\\|?*'
    for ch in invalid:
        result = result.replace(ch, schema.separator)

    return result


def _compute_file_hash(path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hex digest of a file's contents."""
    sha = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


def _auto_increment(path: Path) -> Path:
    """Append a counter to the filename stem until a free name is found.

    Example: foo.txt → foo (2).txt → foo (3).txt
    """
    stem = path.stem
    ext = path.suffix
    parent = path.parent
    counter = 2
    while True:
        candidate = parent / f"{stem} ({counter}){ext}"
        if not candidate.exists():
            return candidate
        counter += 1


# ---------------------------------------------------------------------------
# Real disk operation
# ---------------------------------------------------------------------------

def _execute_single(src: Path, dst: Path, tags: list[str]) -> None:
    """Record rollback entry, then **move** (not copy) src→dst via shutil.move.

    Tags are written to the workspace tag index (tags_index.json) instead of
    being embedded in the filename — this avoids MAX_PATH issues.
    """
    entry = RollbackEntry(
        entry_id=0,  # assigned by record_operation
        operation=OperationType.RENAME,
        original_path=str(src),
        new_path=str(dst),
        tags_snapshot=tags,
    )
    record_operation(entry)

    dst.parent.mkdir(parents=True, exist_ok=True)

    # If overwriting, remove the destination first
    if dst.exists():
        dst.unlink()

    shutil.move(str(src), str(dst))

    # Write tags to the decoupled index
    index_set_tags(dst.parent, dst.name, tags)
