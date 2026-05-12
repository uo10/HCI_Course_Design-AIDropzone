"""
Rollback / Undo models.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .common import OperationStatus


class OperationType(str, Enum):
    RENAME = "rename"
    EXPORT = "export"
    DELETE = "delete"


class RollbackEntry(BaseModel):
    """One journal record written *before* a destructive action."""

    entry_id: int = Field(..., ge=0)
    operation: OperationType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    original_path: str = Field(..., description="Path before the operation")
    new_path: Optional[str] = Field(default=None, description="Path after the operation (if applicable)")
    tags_snapshot: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict, description="Arbitrary restore payload")


class UndoRequest(BaseModel):
    """Request to undo the most recent N operations."""

    count: int = Field(default=1, ge=1, le=100, description="Number of operations to undo")
    filter_operation: Optional[OperationType] = Field(
        default=None,
        description="If set, only undo operations of this type",
    )


class UndoResult(BaseModel):
    status: OperationStatus
    undone: list[RollbackEntry] = Field(default_factory=list)
    failed: list[dict] = Field(
        default_factory=list,
        description="Entries that could not be rolled back: [{'entry_id': ..., 'error': ...}, ...]",
    )
    remaining_log_size: int = Field(
        default=0,
        description="Number of entries still in the journal after undo",
    )
