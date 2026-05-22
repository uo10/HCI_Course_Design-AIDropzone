r"""
AI Dropzone — FastAPI HTTP Server.

Start the server:
    cd D:\HCI_Course_Design-AIDropzone
    venv\Scripts\activate
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models.parser import BatchParseRequest, BatchParseResult, ParseRequest, ParseResult
from .models.renamer import RenameRequest, RenameResult
from .models.rollback import UndoRequest, UndoResult
from .models.exporter import ExportRequest, ExportResult
from .modules.mock_ai_parser import parse_file
from .modules.file_renamer import rename_files
from .modules.rollback import undo_operation
from .modules.tag_exporter import export_packages

app = FastAPI(title="AI Dropzone Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/parse", response_model=ParseResult)
def route_parse(body: ParseRequest) -> ParseResult:
    """AI-parses a single file. Returns classification, tags, and naming suggestion."""
    return parse_file(body.file)


@app.post("/parse/batch", response_model=BatchParseResult)
def route_parse_batch(body: BatchParseRequest) -> BatchParseResult:
    """AI-parses multiple files in one call."""
    from .models.common import OperationStatus

    items, errors = [], []
    for fm in body.files:
        r = parse_file(fm)
        if r.status == "success" and r.data:
            items.append(r.data)
        else:
            errors.append({"path": fm.path, "error": r.error})

    return BatchParseResult(
        status=OperationStatus.SUCCESS if not errors else OperationStatus.FAILURE,
        items=items,
        errors=errors,
    )


@app.post("/rename", response_model=RenameResult)
def route_rename(body: RenameRequest) -> RenameResult:
    """Renames files on disk. Set dry_run=true to preview without writing."""
    return rename_files(body)


@app.post("/undo", response_model=UndoResult)
def route_undo(body: UndoRequest) -> UndoResult:
    """Undoes the most recent N file operations (rename, export, delete)."""
    return undo_operation(body)


@app.post("/export", response_model=ExportResult)
def route_export(body: ExportRequest) -> ExportResult:
    """Exports files matching the given tags as a .zip archive with manifest."""
    return export_packages(body)
