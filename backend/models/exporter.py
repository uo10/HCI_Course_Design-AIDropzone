"""
Tag-Based Package Export models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .common import OperationStatus, TagSet


class ManifestEntry(BaseModel):
    """One file described in the export manifest."""

    original_path: str
    name_in_package: str
    size_bytes: int
    tags: TagSet
    checksum_sha256: str = Field(..., description="SHA-256 hex digest of file contents")


class ExportManifest(BaseModel):
    """Manifest written as manifest.json inside the exported .zip."""

    created_at: datetime = Field(default_factory=datetime.utcnow)
    tag_filter: TagSet = Field(..., description="Tags used to select files for this export")
    total_files: int
    total_size_bytes: int
    entries: list[ManifestEntry]


class ExportRequest(BaseModel):
    """Request to export files matching given tags OR an explicit file list."""

    tags: TagSet = Field(
        default_factory=set,
        description="Tags to filter by — at least one of tags or file_paths required",
    )
    output_dir: str = Field(..., description="Directory where the .zip will be written")
    package_name: str = Field(
        default="export",
        description="Name of the .zip file (without extension)",
    )
    include_manifest: bool = Field(default=True)
    file_paths: Optional[list[str]] = Field(
        default=None,
        description="Explicit list of file paths to package (overrides tags)",
    )


class ExportResult(BaseModel):
    status: OperationStatus
    zip_path: Optional[str] = Field(default=None, description="Absolute path of the generated .zip")
    manifest: Optional[ExportManifest] = Field(default=None)
    errors: list[dict] = Field(default_factory=list)
