"""
Tag-Based Package Exporter.

Groups files by tags, copies them to a staging directory, writes a manifest,
compresses everything into a .zip, and records a rollback entry.

Public API:
    export_packages(request) -> ExportResult
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.common import OperationStatus
from ..models.exporter import (
    ExportManifest,
    ExportRequest,
    ExportResult,
    ManifestEntry,
)
from ..models.rollback import OperationType, RollbackEntry
from ..utils.config import get_workspace_root
from .rollback import record_operation

# Patterns to exclude when extracting tags from filenames
_RE_HASH = re.compile(r"^[a-f0-9]{8,}$")       # e.g. 315f5bdb
_RE_DATE = re.compile(r"^\d{8}$")               # e.g. 20260512
_RE_EXT  = re.compile(r"^[a-z0-9]{1,6}$")       # short extension-like tokens


# ---------------------------------------------------------------------------
# Tag index
# ---------------------------------------------------------------------------

def _build_tag_index(workspace: Path) -> dict[str, set[Path]]:
    """Walk *workspace* and map each tag-like filename token to matching files.

    Only regular files are indexed.  Directories are skipped.
    """
    index: dict[str, set[Path]] = {}
    if not workspace.is_dir():
        return index

    for entry in workspace.iterdir():
        if not entry.is_file():
            continue
        tokens = _extract_tag_tokens(entry.stem)
        for token in tokens:
            index.setdefault(token, set()).add(entry.resolve())
    return index


def _extract_tag_tokens(stem: str) -> set[str]:
    """Return the set of tag-like tokens from a filename stem.

    Example: 'document_readme_315f5bdb' → {'document', 'readme'}
    """
    tokens: set[str] = set()
    for part in stem.split("_"):
        low = part.lower()
        if not low:
            continue
        if _RE_HASH.match(low):
            continue
        if _RE_DATE.match(low):
            continue
        if _RE_EXT.match(low) and len(low) <= 4:
            continue
        # Accept only alpha + optional trailing digits (e.g. 'photo2')
        if re.match(r"^[a-z][a-z0-9]*$", low):
            tokens.add(low)
    return tokens


def _find_files_by_tags(
    tags: set[str],
    workspace: Path,
) -> tuple[list[Path], dict[str, set[str]]]:
    """Return (files, file_tags_map) where each file has ALL requested tags."""
    index = _build_tag_index(workspace)

    # Start with files matching the first tag, then intersect
    tag_list = sorted(tags)
    if not tag_list:
        return [], {}

    candidates: set[Path] = index.get(tag_list[0], set()).copy()
    for tag in tag_list[1:]:
        candidates &= index.get(tag, set())

    # Build per-file tag map
    file_tags: dict[str, set[str]] = {}
    for p in sorted(candidates):
        file_tags[str(p)] = _extract_tag_tokens(p.stem)

    return sorted(candidates), file_tags


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def _build_manifest(
    staging: Path,
    files: list[Path],
    file_tags: dict[str, set[str]],
    tag_filter: set[str],
) -> ExportManifest:
    """Create an ExportManifest from the files staged for export."""
    entries: list[ManifestEntry] = []
    total_size = 0

    for src in files:
        size = src.stat().st_size
        total_size += size
        checksum = _sha256_hex(src)
        entries.append(ManifestEntry(
            original_path=str(src),
            name_in_package=src.name,
            size_bytes=size,
            tags=file_tags.get(str(src), set()),
            checksum_sha256=checksum,
        ))

    return ExportManifest(
        created_at=datetime.utcnow(),
        tag_filter=tag_filter,
        total_files=len(files),
        total_size_bytes=total_size,
        entries=entries,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256_hex(path: Path) -> str:
    """SHA-256 hex digest of file contents."""
    sha = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(65536)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def export_packages(request: ExportRequest) -> ExportResult:
    """Export files matching *request.tags* as a .zip archive.

    Steps:
        1. Scan workspace for files whose names contain ALL requested tags.
        2. Copy matches into a staging directory.
        3. Generate manifest.json inside staging.
        4. Compress staging → .zip via shutil.make_archive.
        5. Record a rollback entry (EXPORT) so undo can delete the zip.
        6. Clean up staging.
    """
    staging: Optional[Path] = None
    try:
        workspace = get_workspace_root()
        output_dir = Path(request.output_dir).resolve()

        # ---- 1. Find matching files ----
        matched, file_tags = _find_files_by_tags(request.tags, workspace)

        # ---- 2. Create staging directory ----
        staging = Path(tempfile.mkdtemp(prefix="aidropzone_export_"))

        for src in matched:
            dst = staging / src.name
            shutil.copy2(str(src), str(dst))

        # ---- 3. Manifest ----
        manifest = _build_manifest(staging, matched, file_tags, request.tags)
        if request.include_manifest:
            manifest_path = staging / "manifest.json"
            manifest_path.write_text(
                manifest.model_dump_json(indent=2),
                encoding="utf-8",
            )

        # ---- 4. Compress ----
        output_dir.mkdir(parents=True, exist_ok=True)
        zip_base = str(output_dir / request.package_name)
        zip_result = shutil.make_archive(
            base_name=zip_base,
            format="zip",
            root_dir=str(staging),
        )
        zip_path = Path(zip_result).resolve()

        # ---- 5. Rollback hook ----
        record_operation(RollbackEntry(
            entry_id=0,
            operation=OperationType.EXPORT,
            original_path="",
            new_path=str(zip_path),
            tags_snapshot=sorted(request.tags),
            metadata={"total_files": manifest.total_files},
        ))

        return ExportResult(
            status=OperationStatus.SUCCESS,
            zip_path=str(zip_path),
            manifest=manifest,
        )

    except Exception as exc:
        return ExportResult(
            status=OperationStatus.FAILURE,
            errors=[{"context": "export_packages", "error": str(exc)}],
        )

    finally:
        # ---- 6. Cleanup staging ----
        if staging is not None and staging.exists():
            try:
                shutil.rmtree(staging, ignore_errors=True)
            except Exception:
                pass
