# -*- mode: python ; coding: utf-8 -*-
"""Build: pyinstaller backend/build/pyinstaller.spec (from repo root)."""

from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent.parent

distpath = str(ROOT / "backend" / "dist")
workpath = str(ROOT / "backend" / "build" / "pyinstaller-work")

block_cipher = None

hiddenimports = [
    "backend.main",
    "backend.models.common",
    "backend.models.exporter",
    "backend.models.parser",
    "backend.models.renamer",
    "backend.models.rollback",
    "backend.models.settings",
    "backend.modules.file_renamer",
    "backend.modules.llm_parser",
    "backend.modules.mock_ai_parser",
    "backend.modules.rollback",
    "backend.modules.tag_exporter",
    "backend.modules.tag_index",
    "backend.utils.config",
    "backend.utils.file_preview",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "fastapi",
    "pydantic",
    "httpx",
    "httpx._transports.default",
    "anyio",
    "anyio._backends._asyncio",
    "PyPDF2",
    "docx",
    "openpyxl",
    "pptx",
]

a = Analysis(
    [str(ROOT / "backend" / "build" / "server_entry.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[(str(ROOT / "backend" / "config.example.json"), "backend")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="aidropzone-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="aidropzone-server",
)
