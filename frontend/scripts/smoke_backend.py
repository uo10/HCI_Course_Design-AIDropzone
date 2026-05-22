#!/usr/bin/env python3
"""
直接调用本仓库 backend/ 里的 Python 模块（不经过 HTTP，不修改 backend 源码）。

在仓库根目录执行：
  python frontend/scripts/smoke_backend.py

可选环境变量：
  TEST_FILE=C:\\真实路径\\file.png
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# 仓库根目录 = frontend/scripts 的上两级
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.models.common import FileMetadata
from backend.models.exporter import ExportRequest
from backend.models.renamer import RenameItem, RenameMode, RenameRequest
from backend.models.rollback import UndoRequest
from backend.modules.mock_ai_parser import parse_file
from backend.modules.file_renamer import rename_files
from backend.modules.tag_exporter import export_packages
from backend.modules.rollback import undo_operation

TEST_FILE = os.environ.get(
    "TEST_FILE",
    r"C:\Users\demo\Desktop\screenshot_web.png",
)


def main() -> None:
    print("=== 1. parse_file ===")
    meta = FileMetadata(
        path=TEST_FILE,
        size_bytes=1024,
        extension="png",
        mime_type="image/png",
        name_before_drop=Path(TEST_FILE).name,
    )
    pr = parse_file(meta)
    print("status:", pr.status)
    if pr.data:
        print("suggested_name:", pr.data.suggested_name)
        print("tags:", list(pr.data.tags))
    else:
        print("error:", pr.error)

    print("\n=== 2. rename_files (dry_run=True) ===")
    rr = rename_files(
        RenameRequest(
            items=[
                RenameItem(
                    source_path=TEST_FILE,
                    new_name=Path(TEST_FILE).name,
                    tags_applied=["image", "screenshot"],
                )
            ],
            dry_run=True,
            conflict_mode=RenameMode.AUTO_INCREMENT,
        )
    )
    print("status:", rr.status, "dry_run:", rr.dry_run)
    for item in rr.renamed:
        print(" ", item["old"], "->", item["new"])
    for err in rr.errors:
        print(" error:", err)

    print("\n=== 3. undo_operation ===")
    ur = undo_operation(UndoRequest(count=1, filter_operation="rename"))
    print("status:", ur.status, "undone:", len(ur.undone), "failed:", len(ur.failed))

    print("\n=== 4. export_packages ===")
    er = export_packages(
        ExportRequest(
            tags=["document"],
            output_dir=str(Path.home() / "Desktop"),
            package_name="smoke_test",
            include_manifest=True,
        )
    )
    print("status:", er.status)
    if er.zip_path:
        print("zip_path:", er.zip_path)
    if er.errors:
        print("errors:", er.errors)

    print("\n完成。若 rename 报文件不存在，请设置环境变量 TEST_FILE 为本机真实路径。")
    print("说明：当前 frontend 分支 backend/ 无 main.py，本脚本不测 HTTP。")
    print("要测 HTTP：见 README「启动 HTTP」或 npm run test:api")


if __name__ == "__main__":
    main()
