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
    """Request to export files matching the given tags."""

    tags: TagSet = Field(..., min_length=1, description="Tags to filter by — files must have ALL of these")
    output_dir: str = Field(..., description="Directory where the .zip will be written")
    package_name: str = Field(
        default="export",
        description="Name of the .zip file (without extension)",
    )
    include_manifest: bool = Field(default=True)


class ExportResult(BaseModel):
    status: OperationStatus
    zip_path: Optional[str] = Field(default=None, description="Absolute path of the generated .zip")
    manifest: Optional[ExportManifest] = Field(default=None)
    errors: list[dict] = Field(default_factory=list)
