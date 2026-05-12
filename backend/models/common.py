"""
Shared types used across all modules.

All enums use str,Enum so they serialize to their string values in JSON.
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Annotated, TypeAlias

from pydantic import BaseModel, Field, StringConstraints


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class FileCategory(str, Enum):
    DOCUMENT = "document"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    ARCHIVE = "archive"
    CODE = "code"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    PDF = "pdf"
    UNKNOWN = "unknown"


class OperationStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"


# ---------------------------------------------------------------------------
# Reusable field types
# ---------------------------------------------------------------------------

Tag: TypeAlias = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9_]+$",
    ),
]

TagSet: TypeAlias = set[Tag]


# ---------------------------------------------------------------------------
# Shared models
# ---------------------------------------------------------------------------

class FileMetadata(BaseModel):
    """Information about a file that the frontend sends for parsing.

    This is the entry point for every dropped file — the frontend collects
    the path and stat data, then passes this model to the backend.
    """

    path: str = Field(..., description="Absolute path to the file on disk")
    size_bytes: int = Field(..., ge=0, description="File size in bytes")
    extension: str = Field(..., description="File extension without dot, lowercased")
    mime_type: str = Field(default="application/octet-stream")
    name_before_drop: str = Field(..., description="Original filename including extension")


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code, e.g. 'FILE_NOT_FOUND'")
    message: str = Field(..., description="Human-readable error description")
    context: dict = Field(default_factory=dict, description="Optional diagnostic payload")
