"""
Tag-Based Package Exporter.

Groups files by tags (read from workspace/tags_index.json), copies them to a
staging directory, writes a manifest, compresses everything into a .zip, and
records a rollback entry.

Public API:
    export_packages(request) -> ExportResult
"""

from __future__ import annotations

import hashlib
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
from .tag_index import _SKIP_FILENAMES, load_index


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
    """Export files as a .zip archive.

    Two modes:
        file_paths  — explicit list of paths to package (from frontend checkboxes)
        tags        — tag-based lookup (backward compatible)

    Steps:
        1. Resolve file list from file_paths or tags.
        2. Validate all files are inside workspace_root.
        3. Copy matches into a staging directory.
        4. Generate manifest.json inside staging.
        5. Compress staging → .zip via shutil.make_archive.
        6. Record a rollback entry (EXPORT) so undo can delete the zip.
        7. Clean up staging.
    """
    staging: Optional[Path] = None
    try:
        workspace = get_workspace_root()
        workspace_resolved = workspace.resolve()
        output_dir = Path(request.output_dir).resolve()

        # ---- 1. Resolve file list ----
        matched: list[Path] = []
        file_tags: dict[str, set[str]] = {}
        index_data = load_index(workspace)

        if request.file_paths:
            # Explicit file list (frontend checkbox selection)
            for raw in request.file_paths:
                candidate = Path(raw).resolve()
                # Security: only allow files inside workspace_root
                if not str(candidate).startswith(str(workspace_resolved)):
                    continue
                if candidate.is_file():
                    matched.append(candidate)
                    file_tags[str(candidate)] = set(
                        index_data.get(candidate.name, [])
                    )
        elif request.tags:
            # Tag-based lookup (backward compatible)
            tag_list = sorted(request.tags)
            for filename, file_tags_list in index_data.items():
                if filename in _SKIP_FILENAMES:
                    continue
                if set(tag_list).issubset(set(file_tags_list)):
                    fpath = (workspace / filename).resolve()
                    if fpath.is_file():
                        matched.append(fpath)
                        file_tags[str(fpath)] = set(file_tags_list)

        matched.sort()

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
        # ---- 7. Cleanup staging ----
        if staging is not None and staging.exists():
            try:
                shutil.rmtree(staging, ignore_errors=True)
            except Exception:
                pass
