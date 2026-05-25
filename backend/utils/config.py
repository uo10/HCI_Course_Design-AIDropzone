"""
Shared config manager — single source of truth for config.json.

All modules load workspace_root through this module to avoid duplicated
config-parsing logic and to keep the default-path rule in one place.

Public API:
    load_config()       → dict
    save_config(config) → None
    get_workspace_root() → Path   (creates the directory if missing)
    set_workspace_root(path) → None
"""

from __future__ import annotations

import json
from pathlib import Path


# Resolved at import time — config.json lives next to the backend package
_CONFIG_PATH: Path = Path(__file__).resolve().parent.parent / "config.json"


# ---------------------------------------------------------------------------
# Low-level read / write
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Return the full config dict from config.json."""
    try:
        if not _CONFIG_PATH.is_file():
            return {}
        raw = _CONFIG_PATH.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return {}


def save_config(config: dict) -> None:
    """Atomically overwrite config.json with *config*."""
    tmp = _CONFIG_PATH.with_suffix(".tmp")
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(_CONFIG_PATH)


# ---------------------------------------------------------------------------
# Workspace root
# ---------------------------------------------------------------------------

def _default_workspace() -> Path:
    """The fallback location when workspace_root is missing / empty."""
    return Path.home() / "Documents" / "AIDropzone_Workspace"


def get_workspace_root() -> Path:
    """Resolve the active workspace root (absolute path).

    Priority:
        1. config.json → workspace_root (if set and non-empty)
        2. OS default: ~/Documents/AIDropzone_Workspace
    """
    try:
        cfg = load_config()
        raw = cfg.get("workspace_root")
        if raw and str(raw).strip():
            # Relative paths are relative to the config file's parent (project root)
            ws = _CONFIG_PATH.parent / str(raw)
            ws = ws.resolve()
        else:
            ws = _default_workspace().resolve()
    except Exception:
        ws = _default_workspace().resolve()

    ws.mkdir(parents=True, exist_ok=True)
    return ws


def set_workspace_root(new_path: str) -> Path:
    """Validate, persist, and return the new workspace root.

    Raises:
        ValueError – if *new_path* is not a writable directory.
        OSError    – if the config file cannot be updated.
    """
    target = Path(new_path).resolve()

    # Create the directory tree if it doesn't exist yet
    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ValueError(f"Cannot create directory '{target}': {exc}") from exc

    # Write a sentinel to verify write permission, then clean up
    sentinel = target / ".aidropzone_write_test"
    try:
        sentinel.write_text("ok", encoding="utf-8")
        sentinel.unlink()
    except OSError as exc:
        raise ValueError(f"Directory is not writable: '{target}': {exc}") from exc

    # Persist
    cfg = load_config()
    cfg["workspace_root"] = str(target)
    save_config(cfg)

    return target
