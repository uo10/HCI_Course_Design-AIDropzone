"""
File Renamer models — rename confirmation input & result output.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .common import OperationStatus, TagSet


# ---------------------------------------------------------------------------
# Naming schema
# ---------------------------------------------------------------------------

class NamingSchema(BaseModel):
    """Template for constructing the new filename.

    Placeholders:
      {tag}        — primary tag
      {date}       — YYYYMMDD
      {hash}       — first 8 chars of file hash
      {name}       — original stem
      {ext}        — original extension (without dot)
    """

    pattern: str = Field(
        default="{date}_{name}.{ext}",
        description="Format string using allowed placeholders",
    )
    separator: str = Field(default="_", description="Char inserted between pattern segments")
    case: str = Field(default="lower", description="lower | upper | preserve")


# ---------------------------------------------------------------------------
# 3. 确认重命名时的输入格式  (RenameRequest)
# ---------------------------------------------------------------------------

class RenameMode(str, Enum):
    """What happens when the target name already exists."""

    SKIP = "skip"
    OVERWRITE = "overwrite"
    AUTO_INCREMENT = "auto_increment"


class RenameItem(BaseModel):
    """One file to rename — the frontend sends a list of these after user review."""

    source_path: str = Field(..., description="Current absolute path on disk")
    new_name: str = Field(..., description="Final filename (stem + extension, no directory)")
    tags_applied: TagSet = Field(
        default_factory=set,
        description="Tags confirmed by the user — used for future export",
    )
    notes: str = Field(default="", description="Optional user annotation")


class RenameRequest(BaseModel):
    """The batch rename request the frontend sends when the user confirms."""

    items: list[RenameItem] = Field(..., min_length=1, max_length=500)
    naming: NamingSchema = Field(default_factory=NamingSchema)
    dry_run: bool = Field(
        default=False,
        description="If true, validate and preview without writing to disk",
    )
    conflict_mode: RenameMode = Field(
        default=RenameMode.AUTO_INCREMENT,
        description="How to handle filename conflicts",
    )


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

class RenameResult(BaseModel):
    status: OperationStatus
    dry_run: bool = False
    renamed: list[dict] = Field(
        default_factory=list,
        description="Successful renames: [{'old': ..., 'new': ..., 'tags': [...]}, ...]",
    )
    skipped: list[dict] = Field(
        default_factory=list,
        description="Skipped entries: [{'path': ..., 'reason': ...}, ...]",
    )
    errors: list[dict] = Field(
        default_factory=list,
        description="Failed entries: [{'path': ..., 'error': ...}, ...]",
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)
