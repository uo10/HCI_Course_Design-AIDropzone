"""
Settings models — workspace path query & update.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .common import OperationStatus


class WorkspaceUpdateRequest(BaseModel):
    new_path: str = Field(..., min_length=1, description="New absolute or relative workspace directory path")


class WorkspaceUpdateResponse(BaseModel):
    status: OperationStatus
    workspace_root: str = Field(..., description="Absolute path of the active workspace")
    message: str = Field(default="", description="Human-readable detail")
