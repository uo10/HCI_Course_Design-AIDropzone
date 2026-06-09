"""Edge-case regression tests for all known bugfixes."""
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from backend.models.common import FileMetadata


def _client():
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from fastapi.testclient import TestClient
    from backend.main import app
    return TestClient(app)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

@pytest.fixture
def ws():
    """Create a temp workspace and point config at it."""
    from backend.utils.config import set_workspace_root, get_workspace_root
    _orig = get_workspace_root()
    tmp = Path(tempfile.mkdtemp())
    set_workspace_root(str(tmp))
    yield tmp
    set_workspace_root(str(_orig))
    shutil.rmtree(tmp, ignore_errors=True)


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------

def test_rename_respects_user_name(ws):
    """Bugfix: file renamed to user's new_name, not source stem."""
    c = _client()
    src = ws / "abc.docx"
    src.write_text("hello", encoding="utf-8")
    r = c.post("/rename", json={
        "items": [{"source_path": str(src), "new_name": "cde.docx",
                   "tags_applied": ["doc"], "notes": ""}],
        "dry_run": False,
    })
    assert r.json()["status"] == "success"
    new_name = Path(r.json()["renamed"][0]["new"]).name
    assert "cde" in new_name


def test_same_name_no_delete(ws):
    """Bugfix: renaming to the same name does not delete the file."""
    c = _client()
    src = ws / "keep.docx"
    src.write_text("keep", encoding="utf-8")
    # First move into workspace
    c.post("/rename", json={
        "items": [{"source_path": str(src), "new_name": "keep.docx",
                   "tags_applied": ["doc"], "notes": ""}],
        "dry_run": False,
    })
    ws_file = list(ws.glob("*.docx"))[0]
    # Second rename: same source, same target
    c.post("/rename", json={
        "items": [{"source_path": str(ws_file), "new_name": ws_file.name,
                   "tags_applied": ["doc"], "notes": ""}],
        "dry_run": False,
    })
    assert any(ws.glob("*.docx")), "file should still exist"


def test_chinese_tags_full_pipeline(ws):
    """Chinese tags survive rename -> index -> export."""
    c = _client()
    from backend.modules.tag_index import load_index

    (ws / "cn.docx").write_text("chinese test", encoding="utf-8")
    c.post("/rename", json={
        "items": [{"source_path": str(ws / "cn.docx"), "new_name": "cn.docx",
                   "tags_applied": ["课程作业", "机器学习"], "notes": ""}],
        "dry_run": False,
    })
    idx = load_index(ws)
    cn_found = any("课程作业" in str(v) for v in idx.values())
    assert cn_found, "Chinese tags should be in index"


def test_empty_export_returns_empty_zip(ws):
    """Export with non-existent tag returns zip with 0 files."""
    c = _client()
    out = Path(tempfile.mkdtemp())
    r = c.post("/export", json={
        "tags": ["nonexistent_tag_xyz"], "output_dir": str(out),
        "package_name": "empty",
    })
    assert r.json()["status"] == "success"
    assert r.json()["manifest"]["total_files"] == 0
    shutil.rmtree(out, ignore_errors=True)


def test_metadata_not_in_zip(ws):
    """tags_index.json is never packaged into export zip."""
    c = _client()
    from backend.modules.tag_index import save_index
    (ws / "r.pdf").write_text("r")
    save_index(ws, {"r.pdf": ["doc"], "tags_index.json": ["doc"]})
    out = Path(tempfile.mkdtemp())
    r = c.post("/export", json={
        "tags": ["doc"], "output_dir": str(out), "package_name": "meta",
    })
    names = [e["name_in_package"] for e in r.json()["manifest"]["entries"]]
    assert "tags_index.json" not in names
    shutil.rmtree(out, ignore_errors=True)


def test_api_key_env_resolution():
    """api_key_env reads from os.environ."""
    from backend.modules.llm_parser import _resolve_api_key
    os.environ["TEST_KEY_ENV"] = "sk-real-key"
    cfg = {"api_key_env": "TEST_KEY_ENV"}
    assert _resolve_api_key(cfg) == "sk-real-key"
    del os.environ["TEST_KEY_ENV"]


def test_llm_fallback_injects_hint(ws):
    """LLM failure adds fallback hint to summary."""
    c = _client()
    from backend.utils.config import load_config, save_config
    cfg = load_config()
    cfg["ai_parser"] = "llm"
    cfg.setdefault("ai_parser_options", {}).setdefault("llm", {})["api_key"] = ""
    save_config(cfg)

    r = c.post("/parse", json={
        "file": {"path": str(ws / "a.pdf"), "size_bytes": 1,
                 "extension": "pdf", "mime_type": "x", "name_before_drop": "a.pdf"},
    })
    assert "降级Mock" in r.json()["data"]["summary"]

    cfg["ai_parser"] = "mock"
    save_config(cfg)


def test_file_paths_blocked_outside_workspace(ws):
    """Export with external path is silently filtered out."""
    c = _client()
    (ws / "a.pdf").write_text("a")
    out = Path(tempfile.mkdtemp())
    r = c.post("/export", json={
        "file_paths": [str(ws / "a.pdf"), "C:/Windows/System32/evil.exe"],
        "output_dir": str(out), "package_name": "safe",
    })
    assert r.json()["manifest"]["total_files"] == 1
    shutil.rmtree(out, ignore_errors=True)
