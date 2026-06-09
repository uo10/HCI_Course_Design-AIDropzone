"""PyInstaller entry — bundled FastAPI server for the desktop installer."""

from __future__ import annotations

import os
import socket
import sys
import traceback
from datetime import datetime
from pathlib import Path

# Windowed PyInstaller exe: stdout/stderr are None before any app code runs.
if getattr(sys, "frozen", False):
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

# uvicorn default LOGGING_CONFIG uses use_colors=None → calls sys.stdout.isatty().
WINDOWED_LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(message)s",
            "use_colors": False,
        },
        "access": {
            "()": "uvicorn.logging.AccessFormatter",
            "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
            "use_colors": False,
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
        "access": {
            "formatter": "access",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
    },
}


def _log_path() -> Path:
    override = os.environ.get("AIDROPZONE_LOG_PATH", "").strip()
    if override:
        return Path(override).expanduser()
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or str(Path.home())
    return Path(base) / "AI Dropzone" / "server.log"


def _log(message: str) -> None:
    try:
        path = _log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with path.open("a", encoding="utf-8") as handle:
            handle.write(f"[{stamp}] {message}\n")
    except OSError:
        pass


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _ensure_stdio() -> None:
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def _prepare_runtime() -> None:
    _ensure_stdio()
    if getattr(sys, "frozen", False):
        os.environ.setdefault("AIDROPZONE_PACKAGED", "1")
        exe_dir = os.path.dirname(sys.executable)
        os.environ.setdefault("AIDROPZONE_EXE_DIR", exe_dir)
        os.chdir(exe_dir)
        if exe_dir not in sys.path:
            sys.path.insert(0, exe_dir)


def main() -> None:
    _prepare_runtime()
    port = int(os.environ.get("AIDROPZONE_PORT", "17823"))
    host = "127.0.0.1"

    if _port_open(host, port):
        _log(
            f"Port {port} already in use — backend is probably already running. "
            f"Open http://{host}:{port}/docs in a browser to verify."
        )
        return

    _log(f"Starting aidropzone-server on http://{host}:{port}")

    from backend.utils.config import ensure_config_file

    ensure_config_file()

    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        log_level="info",
        access_log=False,
        log_config=WINDOWED_LOG_CONFIG,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        _log("Fatal error:\n" + traceback.format_exc())
        raise
