"""
AI Parser models — frontend request input & backend result output.

Covers both single-file and batch parsing flows.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .common import FileCategory, FileMetadata, OperationStatus, TagSet


# ---------------------------------------------------------------------------
# 1. 前端请求解析时的输入格式  (ParseRequest)
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    """Request sent by the frontend when a file is dropped.

    This is the primary "input format" the frontend uses to ask the backend
    to parse / classify a single file.
    """

    file: FileMetadata = Field(..., description="Metadata of the dropped file")
    context_tags: Optional[list[str]] = Field(
        default=None,
        description="User-selected tags already applied in the UI before parsing",
    )
    prefer_mock: bool = Field(
        default=False,
        description="If true, use Mock AI even when a real LLM is configured",
    )


class BatchParseRequest(BaseModel):
    """Bulk variant — multiple files in one call."""

    files: list[FileMetadata] = Field(..., min_length=1, max_length=200)
    context_tags: Optional[list[str]] = None
    prefer_mock: bool = False


# ---------------------------------------------------------------------------
# 2. 后端返回的解析结果格式  (ParseResult / ParseItem)
# ---------------------------------------------------------------------------

class ParseItem(BaseModel):
    """Parsed result for a single file."""

    file_path: str = Field(..., description="Original path from the request")
    suggested_name: str = Field(..., description="AI-suggested new filename (without path)")
    category: FileCategory = Field(..., description="Inferred file category")
    tags: TagSet = Field(..., description="Suggested tags (flat set, no hierarchy)")
    summary: str = Field(default="", description="One-sentence AI summary of file contents")
    keywords: list[str] = Field(default_factory=list, description="Extracted keywords")
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score of the AI classification (0-1)",
    )
    parsed_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp when parsing completed",
    )


class ParseResult(BaseModel):
    """Wrapped result for a single-file parse call.

    Always returns this shape — on success: status=SUCCESS + data; on failure: status=FAILURE + error.
    """

    status: OperationStatus
    data: Optional[ParseItem] = Field(default=None, description="Populated on success")
    error: Optional[str] = Field(default=None, description="Populated on failure")


class BatchParseResult(BaseModel):
    """Wrapped result for a batch parse call."""

    status: OperationStatus
    items: list[ParseItem] = Field(default_factory=list, description="Successfully parsed files")
    errors: list[dict] = Field(
        default_factory=list,
        description="Per-file errors: [{'path': ..., 'error': ...}, ...]",
    )
