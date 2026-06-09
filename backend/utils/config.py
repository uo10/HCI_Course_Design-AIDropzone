"""
Shared config manager — single source of truth for config.json.

All modules load workspace_root through this module to avoid duplicated
config-parsing logic and to keep the default-path rule in one place.

Public API:
    load_config()       → dict
    save_config(config) → None
    get_workspace_root() → Path   (creates the directory if missing)
    set_workspace_root(path) → None
    get_config_path()   → Path
    ensure_config_file() → Path   (copy template on first run when packaged)
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path


def get_config_path() -> Path:
    """Resolve config.json location (env override for packaged desktop app)."""
    env = os.environ.get("AIDROPZONE_CONFIG_PATH", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return Path(__file__).resolve().parent.parent / "config.json"


def _config_template_path() -> Path | None:
    """Bundled template shipped beside the PyInstaller exe."""
    if os.environ.get("AIDROPZONE_PACKAGED") != "1":
        return None
    exe_dir = Path(os.environ.get("AIDROPZONE_EXE_DIR", Path.cwd()))
    candidate = exe_dir / "backend" / "config.example.json"
    if candidate.is_file():
        return candidate
    fallback = Path(__file__).resolve().parent.parent / "config.example.json"
    return fallback if fallback.is_file() else None


def ensure_config_file() -> Path:
    """Create user config from template when missing (packaged installs)."""
    config_path = get_config_path()
    if config_path.is_file():
        return config_path

    config_path.parent.mkdir(parents=True, exist_ok=True)
    template = _config_template_path()
    if template is not None:
        shutil.copy2(template, config_path)
    else:
        dev_template = Path(__file__).resolve().parent.parent / "config.example.json"
        if dev_template.is_file():
            shutil.copy2(dev_template, config_path)
        else:
            config_path.write_text("{}", encoding="utf-8")

    return config_path


# ---------------------------------------------------------------------------
# Low-level read / write
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Return the full config dict from config.json."""
    config_path = ensure_config_file()
    try:
        if not config_path.is_file():
            return {}
        raw = config_path.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return {}


def save_config(config: dict) -> None:
    """Atomically overwrite config.json with *config*."""
    config_path = get_config_path()
    tmp = config_path.with_suffix(".tmp")
    config_path.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp.replace(config_path)


# ---------------------------------------------------------------------------
# Workspace root
# ---------------------------------------------------------------------------

def _default_workspace() -> Path:
    """The fallback location when workspace_root is missing / empty."""
    if os.environ.get("AIDROPZONE_PACKAGED") == "1":
        return Path.home() / "Documents" / "AI Dropzone Workspace"
    return Path.home() / "Documents" / "AIDropzone_Workspace"


def get_workspace_root() -> Path:
    """Resolve the active workspace root (absolute path).

    Priority:
        1. config.json → workspace_root (if set and non-empty)
        2. OS default: ~/Documents/AI Dropzone Workspace (packaged) or AIDropzone_Workspace
    """
    try:
        cfg = load_config()
        raw = cfg.get("workspace_root")
        if raw and str(raw).strip():
            p = Path(str(raw))
            if p.is_absolute():
                ws = p.resolve()
            else:
                ws = (get_config_path().parent / str(raw)).resolve()
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

    try:
        target.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ValueError(f"Cannot create directory '{target}': {exc}") from exc

    sentinel = target / ".aidropzone_write_test"
    try:
        sentinel.write_text("ok", encoding="utf-8")
        sentinel.unlink()
    except OSError as exc:
        raise ValueError(f"Directory is not writable: '{target}': {exc}") from exc

    cfg = load_config()
    cfg["workspace_root"] = str(target)
    save_config(cfg)

    return target
