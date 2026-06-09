"""Smoke tests — every route responds 200, every module import clean."""
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from backend.main import app
    return TestClient(app)


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

def test_parse_200(client):
    r = client.post("/parse", json={
        "file": {"path": "C:/t/a.pdf", "size_bytes": 1, "extension": "pdf",
                 "mime_type": "x", "name_before_drop": "a.pdf"},
    })
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_parse_regenerate_200(client):
    r = client.post("/parse/regenerate", json={
        "file": {"path": "C:/t/a.pdf", "size_bytes": 1, "extension": "pdf",
                 "mime_type": "x", "name_before_drop": "a.pdf"},
        "extra_prompt": "test",
    })
    assert r.status_code == 200


def test_rename_dry_run(client):
    r = client.post("/rename", json={
        "items": [{"source_path": "C:/t/a.pdf", "new_name": "a.pdf",
                   "tags_applied": ["doc"], "notes": ""}],
        "dry_run": True,
    })
    assert r.status_code == 200


def test_undo(client):
    r = client.post("/undo", json={"count": 1})
    assert r.status_code == 200


def test_export(client):
    r = client.post("/export", json={
        "tags": ["test"], "output_dir": "C:/tmp", "package_name": "t",
    })
    assert r.status_code == 200


def test_get_config(client):
    r = client.get("/config")
    assert r.status_code == 200
    assert "config" in r.json()


def test_get_journal(client):
    r = client.get("/journal")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_tags(client):
    r = client.get("/tags")
    assert r.status_code == 200


def test_get_settings_workspace(client):
    r = client.get("/settings/workspace")
    assert r.status_code == 200


def test_get_settings_llm(client):
    r = client.get("/settings/llm")
    assert r.status_code == 200


def test_tags_search(client):
    r = client.post("/tags/search", json={"tags": ["doc"]})
    assert r.status_code == 200


def test_tags_rescan(client):
    r = client.post("/tags/rescan")
    assert r.status_code == 200
