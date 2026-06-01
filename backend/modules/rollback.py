"""
Undo / Rollback journal manager.

Journal file: backend/rollback_log.json (an append-only JSON array).

Public API:
    record_operation(entry)     — append a RollbackEntry before a destructive action
    undo_operation(request)     — revert the most recent N operations
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.common import OperationStatus
from ..models.rollback import OperationType, RollbackEntry, UndoRequest, UndoResult

# Journal lives at backend/rollback_log.json, relative to this source file
_DEFAULT_JOURNAL: Path = Path(__file__).resolve().parent.parent / "rollback_log.json"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_journal(path: Path) -> list[dict]:
    """Return the full journal as a list of raw dicts, or [] if missing/corrupt."""
    try:
        if not path.is_file():
            return []
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return []
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return []


def _write_journal(path: Path, entries: list[dict]) -> None:
    """Atomically overwrite the journal file."""
    tmp = path.with_suffix(".tmp")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _next_entry_id(entries: list[dict]) -> int:
    if not entries:
        return 0
    return max(e.get("entry_id", 0) for e in entries) + 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def record_operation(
    entry: RollbackEntry,
    journal_path: Optional[Path] = None,
) -> None:
    """Append a RollbackEntry to the journal before performing a destructive
    file operation.  Must be called *before* the actual rename / delete.

    Raises RuntimeError if the journal cannot be written.
    """
    path = journal_path or _DEFAULT_JOURNAL
    try:
        entries = _read_journal(path)
        mapped = entry.model_dump(mode="json")
        mapped["entry_id"] = _next_entry_id(entries)
        mapped.setdefault("timestamp", datetime.utcnow().isoformat())
        entries.append(mapped)
        _write_journal(path, entries)
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to write rollback journal: {exc}") from exc


def undo_operation(
    request: UndoRequest,
    journal_path: Optional[Path] = None,
) -> UndoResult:
    """Undo operations recorded in the journal.

    Two modes:
      - BY ID:   request.entry_ids → undo only those specific entries.
      - BY N:    request.count → undo the most recent N entries
                 (optionally filtered by request.filter_operation).

    For each qualifying entry:
      - RENAME  → move new_path back to original_path
      - EXPORT  → delete the exported zip
      - DELETE  → cannot undo (recorded as failed)

    Successfully rolled-back entries are removed from the journal.
    """
    path = journal_path or _DEFAULT_JOURNAL
    try:
        entries = _read_journal(path)
        if not entries:
            return UndoResult(
                status=OperationStatus.SUCCESS,
                remaining_log_size=0,
            )

        # Select candidates
        if request.entry_ids is not None:
            # ── BY ID: lookup specific entries ──
            id_set = set(request.entry_ids)
            selected = [e for e in entries if e.get("entry_id") in id_set]
        else:
            # ── BY N: most recent N ──
            candidates = entries
            if request.filter_operation is not None:
                candidates = [
                    e for e in entries
                    if e.get("operation") == request.filter_operation.value
                ]
            selected = candidates[-request.count:] if request.count < len(candidates) else candidates
        # Process newest first (reverse order)
        selected.reverse()

        undone: list[RollbackEntry] = []
        failed: list[dict] = []
        ids_to_remove: set[int] = set()

        for raw in selected:
            entry_id = raw.get("entry_id")
            op_type = raw.get("operation")
            src = raw.get("original_path")
            dst = raw.get("new_path")

            try:
                if op_type == OperationType.RENAME.value and dst:
                    _undo_rename(src, dst)
                    undone.append(RollbackEntry(**raw))
                    ids_to_remove.add(entry_id)
                elif op_type == OperationType.EXPORT.value and dst:
                    _undo_export(dst)
                    undone.append(RollbackEntry(**raw))
                    ids_to_remove.add(entry_id)
                else:
                    failed.append({
                        "entry_id": entry_id,
                        "error": f"Cannot undo operation '{op_type}' (no restore path)",
                    })
            except Exception as exc:
                failed.append({"entry_id": entry_id, "error": str(exc)})

        # Remove successfully undone entries from the journal
        remaining = [e for e in entries if e.get("entry_id") not in ids_to_remove]
        _write_journal(path, remaining)

        overall = (
            OperationStatus.SUCCESS
            if not failed
            else OperationStatus.FAILURE
        )

        return UndoResult(
            status=overall,
            undone=undone,
            failed=failed,
            remaining_log_size=len(remaining),
        )

    except Exception as exc:
        return UndoResult(
            status=OperationStatus.FAILURE,
            failed=[{"entry_id": None, "error": str(exc)}],
        )


# ---------------------------------------------------------------------------
# Per-operation undo helpers
# ---------------------------------------------------------------------------

def _undo_rename(original: str, current: str) -> None:
    """Move *current* (the renamed file) back to *original*."""
    src = Path(current)
    dst = Path(original)

    if not src.exists():
        raise FileNotFoundError(f"File no longer exists at '{current}'")

    dst.parent.mkdir(parents=True, exist_ok=True)

    # If something already sits at the original path, move it out of the way
    if dst.exists():
        backup = dst.with_name(dst.name + ".rollback_conflict")
        shutil.move(str(dst), str(backup))

    shutil.move(str(src), str(dst))


def _undo_export(zip_path: str) -> None:
    """Delete the exported zip artifact."""
    target = Path(zip_path)
    if target.is_file():
        target.unlink()
