r"""
AI Dropzone — FastAPI HTTP Server.

Start the server:
    cd D:\HCI_Course_Design-AIDropzone
    venv\Scripts\activate
    uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models.exporter import ExportRequest, ExportResult
from .models.parser import BatchParseRequest, BatchParseResult, ParseRequest, ParseResult
from .models.renamer import RenameRequest, RenameResult
from .models.rollback import UndoRequest, UndoResult
from .models.settings import WorkspaceUpdateRequest, WorkspaceUpdateResponse
from .modules.file_renamer import rename_files
from .modules.rollback import undo_operation
from .modules.tag_exporter import export_packages
from .modules.tag_index import all_tags as get_all_tags
from .utils.config import get_workspace_root, load_config, save_config, set_workspace_root

app = FastAPI(title="AI Dropzone Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_parser():
    """Return the active parse_file function (mock or real LLM) based on config.

    If the LLM parser fails to import or initialise, falls back to mock.
    """
    cfg = load_config()
    if cfg.get("ai_parser") == "llm":
        try:
            from .modules.llm_parser import parse_file as llm_parse
            return llm_parse
        except Exception:
            pass  # fall back to mock
    from .modules.mock_ai_parser import parse_file as mock_parse
    return mock_parse


@app.post("/parse", response_model=ParseResult)
def route_parse(body: ParseRequest) -> ParseResult:
    """AI-parses a single file. Uses real LLM if configured, else Mock.

    If the real LLM call fails, automatically falls back to the Mock parser
    so the frontend always gets a usable result.
    """
    if body.prefer_mock:
        from .modules.mock_ai_parser import parse_file as mock_parse
        return mock_parse(body.file)

    parser = _get_parser()
    result = parser(body.file)

    # If LLM failed and the user didn't explicitly request mock, fall back
    if result.status == "failure" and not body.prefer_mock:
        cfg = load_config()
        if cfg.get("ai_parser") == "llm":
            from .modules.mock_ai_parser import parse_file as mock_parse
            result = mock_parse(body.file)

    return result


@app.post("/parse/batch", response_model=BatchParseResult)
def route_parse_batch(body: BatchParseRequest) -> BatchParseResult:
    """AI-parses multiple files in one call."""
    from .models.common import OperationStatus

    parser = _get_parser() if not body.prefer_mock else None
    if body.prefer_mock or parser is None:
        from .modules.mock_ai_parser import parse_file as parser

    items, errors = [], []
    for fm in body.files:
        r = parser(fm)
        if r.status == "success" and r.data:
            items.append(r.data)
        else:
            # Fallback to mock on per-file failure
            if not body.prefer_mock:
                from .modules.mock_ai_parser import parse_file as mock_parse
                r2 = mock_parse(fm)
                if r2.status == "success" and r2.data:
                    items.append(r2.data)
                    continue
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


# ---------------------------------------------------------------------------
# Settings routes
# ---------------------------------------------------------------------------

@app.get("/settings/workspace", response_model=dict)
def route_get_workspace() -> dict:
    """Return the absolute path of the active workspace (整理篮)."""
    try:
        ws = get_workspace_root()
        return {
            "status": "success",
            "workspace_root": str(ws),
            "exists": ws.is_dir(),
        }
    except Exception as exc:
        return {"status": "failure", "error": str(exc)}


@app.post("/settings/workspace", response_model=WorkspaceUpdateResponse)
def route_set_workspace(body: WorkspaceUpdateRequest) -> WorkspaceUpdateResponse:
    """Change the workspace root directory.  The backend validates write
    permission before persisting the new path."""
    from .models.common import OperationStatus

    try:
        new_root = set_workspace_root(body.new_path)
        return WorkspaceUpdateResponse(
            status=OperationStatus.SUCCESS,
            workspace_root=str(new_root),
            message=f"Workspace updated to '{new_root}'",
        )
    except (ValueError, OSError) as exc:
        return WorkspaceUpdateResponse(
            status=OperationStatus.FAILURE,
            workspace_root="",
            message=str(exc),
        )


# ---------------------------------------------------------------------------
# Tag library
# ---------------------------------------------------------------------------

@app.get("/tags", response_model=dict)
def route_get_tags() -> dict:
    """Return the full tag library: every tag currently in use + its file count.

    Auto-discovers any workspace files not yet in the index before
    returning results, so manually placed files show up immediately.
    """
    try:
        ws = get_workspace_root()
        from .modules.tag_index import load_index, rescan_index
        rescan_index(ws)  # pick up any unindexed workspace files
        index = load_index(ws)

        tag_counts: dict[str, int] = {}
        for file_tags in index.values():
            for t in file_tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1

        return {
            "status": "success",
            "workspace_root": str(ws),
            "total_files": len(index),
            "tags": dict(sorted(tag_counts.items())),
        }
    except Exception as exc:
        return {"status": "failure", "error": str(exc)}


@app.post("/tags/rescan", response_model=dict)
def route_rescan_tags() -> dict:
    """Explicitly rescan the workspace and rebuild the tag index.

    Use this after manually adding files to the workspace directory,
    or when the index appears out-of-sync.
    """
    try:
        ws = get_workspace_root()
        from .modules.tag_index import rescan_index, load_index
        added = rescan_index(ws)
        index = load_index(ws)
        return {
            "status": "success",
            "workspace_root": str(ws),
            "newly_indexed": added,
            "total_files": len(index),
        }
    except Exception as exc:
        return {"status": "failure", "error": str(exc)}


# ---------------------------------------------------------------------------
# LLM configuration
# ---------------------------------------------------------------------------

def _mask_key(key: str) -> str:
    """Mask an API key for safe display: show first 4 + last 4 chars."""
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


@app.get("/settings/llm", response_model=dict)
def route_get_llm_config() -> dict:
    """Return the current LLM configuration.  The API key is masked."""
    try:
        cfg = load_config()
        llm = cfg.get("ai_parser_options", {}).get("llm", {})
        raw_key = llm.get("api_key", "") or llm.get("api_key_env", "")
        return {
            "status": "success",
            "provider": llm.get("provider", ""),
            "model": llm.get("model", ""),
            "api_key_masked": _mask_key(raw_key),
            "api_key_env": llm.get("api_key_env", ""),
            "timeout_seconds": llm.get("timeout_seconds", 30),
            "max_retries": llm.get("max_retries", 3),
        }
    except Exception as exc:
        return {"status": "failure", "error": str(exc)}


@app.post("/settings/llm", response_model=dict)
def route_set_llm_config(body: dict) -> dict:
    """Update the LLM configuration.  Only supplied fields are changed."""
    try:
        cfg = load_config()
        llm_opts = cfg.setdefault("ai_parser_options", {}).setdefault("llm", {})

        for field in ("provider", "model", "api_key_env", "api_key"):
            if field in body and body[field] is not None:
                llm_opts[field] = body[field]

        for int_field in ("timeout_seconds", "max_retries"):
            if int_field in body and body[int_field] is not None:
                llm_opts[int_field] = int(body[int_field])

        save_config(cfg)

        return {
            "status": "success",
            "provider": llm_opts.get("provider", ""),
            "model": llm_opts.get("model", ""),
            "api_key_masked": _mask_key(llm_opts.get("api_key", llm_opts.get("api_key_env", ""))),
        }
    except Exception as exc:
        return {"status": "failure", "error": str(exc)}


# ---------------------------------------------------------------------------
# Full config (GET /config + PUT /config) — per TEMP_API_ALIGNMENT.md
# ---------------------------------------------------------------------------

@app.get("/config", response_model=dict)
def route_get_config() -> dict:
    """Return the full backend configuration for the settings page.

    LLM API key is masked; api_key_set indicates whether a key is present.
    """
    try:
        cfg = load_config()
        llm = cfg.get("ai_parser_options", {}).get("llm", {})
        raw_key = llm.get("api_key", "") or llm.get("api_key_env", "")
        return {
            "config": {
                "workspace_root": str(get_workspace_root()),
                "ai_parser": cfg.get("ai_parser", "mock"),
                "ai_parser_options": {
                    "llm": {
                        "provider": llm.get("provider", ""),
                        "model": llm.get("model", ""),
                        "base_url": llm.get("base_url", ""),
                        "api_key_set": bool(raw_key),
                        "api_key": _mask_key(raw_key),
                    },
                },
            },
        }
    except Exception as exc:
        return {"config": None, "error": str(exc)}


@app.put("/config", response_model=dict)
def route_put_config(body: dict) -> dict:
    """Batch-update backend configuration.  Only supplied fields change.

    Body keys (all optional):
        workspace_root, ai_parser, llm_provider, llm_model,
        llm_base_url, llm_api_key
    """
    try:
        cfg = load_config()
        llm_opts = cfg.setdefault("ai_parser_options", {}).setdefault("llm", {})

        if "workspace_root" in body and body["workspace_root"]:
            cfg["workspace_root"] = body["workspace_root"]
        if "ai_parser" in body:
            cfg["ai_parser"] = body["ai_parser"]
        if "llm_provider" in body:
            llm_opts["provider"] = body["llm_provider"]
        if "llm_model" in body:
            llm_opts["model"] = body["llm_model"]
        if "llm_base_url" in body:
            llm_opts["base_url"] = body["llm_base_url"]
        if "llm_api_key" in body and body["llm_api_key"]:
            llm_opts["api_key"] = body["llm_api_key"]

        save_config(cfg)

        raw_key = llm_opts.get("api_key", "") or llm_opts.get("api_key_env", "")
        return {
            "config": {
                "workspace_root": str(get_workspace_root()),
                "ai_parser": cfg.get("ai_parser", "mock"),
                "ai_parser_options": {
                    "llm": {
                        "provider": llm_opts.get("provider", ""),
                        "model": llm_opts.get("model", ""),
                        "base_url": llm_opts.get("base_url", ""),
                        "api_key_set": bool(raw_key),
                        "api_key": _mask_key(raw_key),
                    },
                },
            },
        }
    except Exception as exc:
        return {"config": None, "error": str(exc)}


# ---------------------------------------------------------------------------
# Journal (GET /journal) — per TEMP_API_ALIGNMENT.md
# ---------------------------------------------------------------------------

@app.get("/journal", response_model=list)
def route_get_journal() -> list:
    """Return the full rollback journal as an array of entries."""
    try:
        from pathlib import Path as _Path
        from .modules.rollback import _read_journal
        return _read_journal(_Path(__file__).resolve().parent / "rollback_log.json")
    except Exception as exc:
        return [{"error": str(exc)}]
