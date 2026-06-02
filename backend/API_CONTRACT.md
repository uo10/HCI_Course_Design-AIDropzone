# API Contract — AI Dropzone Backend

> **Audience**: Frontend developers consuming the AI Dropzone Windows desktop backend.
> **Version**: 1.0.0
> **Convention**: All values in this document are JSON-serializable. Field names match the
> Pydantic model attributes exactly (camelCase-free, snake_case throughout). Timestamps are
> UTC ISO-8601 strings. Paths are Windows absolute paths with backslashes escaped per JSON
> rules.

---

## 1. Common Types

### 1.1 FileMetadata — 文件元信息

前端在拖拽文件后采集，随解析请求一同发送。

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | yes | 文件在磁盘上的绝对路径 |
| `size_bytes` | `int` | yes | 文件大小（字节），≥ 0 |
| `extension` | `string` | yes | 扩展名，无点号，小写（如 `"png"`） |
| `mime_type` | `string` | no | MIME 类型，默认 `"application/octet-stream"` |
| `name_before_drop` | `string` | yes | 原始文件名含扩展名（如 `"screenshot_web.png"`） |

### 1.2 FileCategory — 文件类别枚举

| Value |
|-------|
| `"document"` `"image"` `"video"` `"audio"` `"archive"` `"code"` `"spreadsheet"` `"presentation"` `"pdf"` `"unknown"` |

### 1.3 OperationStatus — 操作状态枚举

| Value | Meaning |
|-------|---------|
| `"success"` | 全部子项成功 |
| `"failure"` | 至少一个子项失败（检查 `errors` 字段） |

### 1.4 Tag — 标签约束

- 格式：允许中英文/数字/下划线，禁止空白符及 `<>:"/\|?*` 等文件系统非法字符
- 长度：1–64 字符
- 场景：平铺集合，无嵌套层级（支持中文标签）

### 1.5 NamingSchema — 命名模板

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pattern` | `string` | `"{tag}_{date}_{name}.{ext}"` | 占位符：`{tag}` `{date}` `{hash}` `{name}` `{ext}` |
| `separator` | `string` | `"_"` | 文件名非法字符的替换符 |
| `case` | `string` | `"lower"` | `"lower"` / `"upper"` / `"preserve"` |

### 1.6 RenameMode — 冲突处理策略

| Value | Behavior |
|-------|----------|
| `"skip"` | 目标已存在 → 跳过 |
| `"overwrite"` | 目标已存在 → 覆盖 |
| `"auto_increment"` | 目标已存在 → 自动追加 ` (2)` ` (3)` |

---

## 2. Interface: AI File Parsing

### 2.1 触发时机

用户将文件拖入 AI Dropzone 窗口后，前端采集文件元信息并立即发送此请求，
获得 AI 分类结果和命名建议，展示给用户预览。

### 2.2 敏感文件识别

Mock AI 解析器内置了基础敏感信息拦截规则。如果 `file.name_before_drop` 中包含以下任一关键词，系统会自动标记该文件：

| 敏感词 |
|--------|
| `身份证` `简历` `成绩单` `合同` `密码` `病历` |

**命中后的行为：**

- 标签集合中自动追加 `"sensitive"` 标签
- `summary` 末尾补充 `" — ⚠ 检测到敏感信息"` 警告
- 前端可据此触发二次确认弹窗或红色高亮提示
- 分类与命名等其他字段不受影响

> 此功能当前仅在 Mock AI 层实现。接入真 LLM 后，敏感文件识别将由模型提示词接管，
> 实现更语义化的隐私文件检测（如识别不含关键词但内容涉及隐私的文档）。

### 2.3 Request — 单文件解析

```
POST /parse
```

```json
{
  "file": {
    "path": "C:\\Users\\demo\\Desktop\\screenshot_web.png",
    "size_bytes": 245760,
    "extension": "png",
    "mime_type": "image/png",
    "name_before_drop": "screenshot_web.png"
  },
  "context_tags": ["work", "design"],
  "prefer_mock": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `FileMetadata` | yes | 被拖拽文件的信息 |
| `context_tags` | `string[]?` | no | 用户在 UI 中预选的标签 |
| `prefer_mock` | `bool` | no | 强制使用 Mock AI（即使已配置真 LLM） |

### 2.4 Request — 批量解析

```
POST /parse/batch
```

```json
{
  "files": [
    {
      "path": "C:\\Users\\demo\\Desktop\\photo.jpg",
      "size_bytes": 1024000,
      "extension": "jpg",
      "mime_type": "image/jpeg",
      "name_before_drop": "photo.jpg"
    },
    {
      "path": "C:\\Users\\demo\\Documents\\report.pdf",
      "size_bytes": 512000,
      "extension": "pdf",
      "mime_type": "application/pdf",
      "name_before_drop": "report.pdf"
    }
  ],
  "context_tags": null,
  "prefer_mock": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | `FileMetadata[]` | yes | 1–200 条 |
| `context_tags` | `string[]?` | no | — |
| `prefer_mock` | `bool` | no | — |

### 2.5 Response — 成功（普通文件）

```json
{
  "status": "success",
  "data": {
    "file_path": "C:\\Users\\demo\\Desktop\\screenshot_web.png",
    "suggested_name": "image_a3f2b1c0_screenshot_web.png",
    "category": "image",
    "tags": ["image", "media", "screenshot"],
    "summary": "A raster or vector image file.",
    "keywords": ["screenshot"],
    "confidence": 0.85,
    "parsed_at": "2026-05-12T08:30:00.123456"
  },
  "error": null
}
```

### 2.6 Response — 成功（敏感文件）

当文件名包含敏感关键词时（如"个人简历_2025.pdf"），返回中自动包含 `"sensitive"` 标签与警告文案：

```json
{
  "status": "success",
  "data": {
    "file_path": "C:\\Users\\demo\\Documents\\个人简历_2025.pdf",
    "suggested_name": "document_a1b2c3d4_个人简历_2025.pdf",
    "category": "pdf",
    "tags": ["document", "pdf", "sensitive"],
    "summary": "A Portable Document Format file suitable for sharing. — ⚠ 检测到敏感信息",
    "keywords": [],
    "confidence": 0.85,
    "parsed_at": "2026-05-12T08:30:00.500000"
  },
  "error": null
}
```

### 2.7 Response — 失败

```json
{
  "status": "failure",
  "data": null,
  "error": "Unsupported file extension: .xyz"
}
```

### 2.8 Response — 批量

```json
{
  "status": "success",
  "items": [
    {
      "file_path": "C:\\Users\\demo\\Desktop\\photo.jpg",
      "suggested_name": "image_d4e5f6a0_photo.jpg",
      "category": "image",
      "tags": ["image", "media"],
      "summary": "A raster or vector image file.",
      "keywords": ["photo"],
      "confidence": 0.85,
      "parsed_at": "2026-05-12T08:30:00.200000"
    }
  ],
  "errors": [
    {"path": "C:\\Users\\demo\\Documents\\report.pdf", "error": "File not found"}
  ]
}
```

---

## 3. Interface: File Rename

### 3.1 触发时机

用户在 AI 解析结果预览界面中确认/修改文件名和标签后，点击"确认重命名"按钮。
前端将确认后的列表打包发送。

> **⚠ 重要：执行该接口后，原文件将被物理移动（`shutil.move`）归档至统一的整理篮
> （Workspace）目录中，不再停留于原处。这是产品的核心"清理桌面"动作——不是复制留存。**
>
> **标签存储：标签不再嵌入文件名（避免 MAX_PATH 限制），而是独立存储在
> `workspace_root/tags_index.json` 索引表中。文件名仅包含日期、哈希与原 stem。**

### 3.2 Request

```
POST /rename
```

```json
{
  "items": [
    {
      "source_path": "C:\\Users\\demo\\Desktop\\screenshot_web.png",
      "new_name": "screenshot_web.png",
      "tags_applied": ["design", "screenshot"],
      "notes": "客户确认版"
    },
    {
      "source_path": "C:\\Users\\demo\\Desktop\\readme.txt",
      "new_name": "readme.txt",
      "tags_applied": ["document", "readme"],
      "notes": ""
    }
  ],
  "naming": {
    "pattern": "{tag}_{date}_{name}.{ext}",
    "separator": "_",
    "case": "lower"
  },
  "dry_run": false,
  "conflict_mode": "auto_increment"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | `RenameItem[]` | yes | 1–500 条 |
| `items[].source_path` | `string` | yes | 当前磁盘绝对路径 |
| `items[].new_name` | `string` | yes | 用户最终确认的文件名（含扩展名，无目录） |
| `items[].tags_applied` | `string[]` | yes | 用户确认的标签（后续导出依据） |
| `items[].notes` | `string` | no | 用户附注 |
| `naming` | `NamingSchema` | no | 默认 `"{tag}_{date}_{name}.{ext}"` |
| `dry_run` | `bool` | no | `true` = 仅预览不写盘 |
| `conflict_mode` | `string` | no | `"skip"` / `"overwrite"` / `"auto_increment"` |

### 3.3 Response — 成功

```json
{
  "status": "success",
  "dry_run": false,
  "renamed": [
    {
      "old": "C:\\Users\\demo\\Desktop\\screenshot_web.png",
      "new": "C:\\Users\\demo\\Documents\\AIDropzone_Workspace\\design_20260512_screenshot_web.png",
      "tags": ["design", "screenshot"]
    }
  ],
  "skipped": [
    {"path": "C:\\Users\\demo\\Desktop\\readme.txt", "reason": "target_exists"}
  ],
  "errors": [],
  "timestamp": "2026-05-12T08:30:01.000000"
}
```

### 3.4 Response — Dry Run 预览

```json
{
  "status": "success",
  "dry_run": true,
  "renamed": [
    {
      "old": "C:\\Users\\demo\\Desktop\\screenshot_web.png",
      "new": "C:\\Users\\demo\\Documents\\AIDropzone_Workspace\\design_20260512_screenshot_web.png",
      "tags": ["design", "screenshot"]
    }
  ],
  "skipped": [],
  "errors": [],
  "timestamp": "2026-05-12T08:30:00.500000"
}
```

---

## 4. Interface: Undo / Rollback

### 4.1 触发时机

用户点击"撤销"按钮（或按 Ctrl+Z），前端发送撤销请求。
系统按时间倒序回滚最近的操作。

### 4.2 Request

```
POST /undo
```

```json
{
  "count": 3,
  "filter_operation": "rename"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `count` | `int` | yes | 撤销最近 N 条操作（1–100） |
| `filter_operation` | `string?` | no | `"rename"` / `"export"` / `"delete"`；不传则撤销所有类型 |

### 4.3 Response — 成功

```json
{
  "status": "success",
  "undone": [
    {
      "entry_id": 5,
      "operation": "rename",
      "timestamp": "2026-05-12T08:29:55.000000",
      "original_path": "C:\\Users\\demo\\Desktop\\photo.jpg",
      "new_path": "C:\\Users\\demo\\Desktop\\image_photo_07338a44.jpg",
      "tags_snapshot": ["image", "photo"],
      "metadata": {}
    }
  ],
  "failed": [],
  "remaining_log_size": 4
}
```

### 4.4 Response — 部分失败

```json
{
  "status": "failure",
  "undone": [],
  "failed": [
    {
      "entry_id": 3,
      "error": "File no longer exists at 'C:\\Users\\demo\\Desktop\\image_photo_07338a44.jpg'"
    }
  ],
  "remaining_log_size": 6
}
```

---

## 5. Interface: Tag-Based Package Export

### 5.1 触发时机

用户在标签面板中勾选一个或多个标签，点击"导出"按钮。
系统找出同时拥有所有已选标签的文件，打包为 `.zip`。

### 5.2 Request

```
POST /export
```

```json
{
  "tags": ["document", "report"],
  "output_dir": "C:\\Users\\demo\\Desktop\\exports",
  "package_name": "q1_reports",
  "include_manifest": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | `string[]` | yes | 至少 1 个标签，文件必须拥有全部（AND 语义） |
| `output_dir` | `string` | yes | `.zip` 输出目录（自动创建） |
| `package_name` | `string` | no | `.zip` 文件名（不含扩展名），默认 `"export"` |
| `include_manifest` | `bool` | no | 是否在 zip 内写入 `manifest.json`，默认 `true` |

### 5.3 Response — 成功

```json
{
  "status": "success",
  "zip_path": "C:\\Users\\demo\\Desktop\\exports\\q1_reports.zip",
  "manifest": {
    "created_at": "2026-05-12T08:30:02.000000",
    "tag_filter": ["document", "report"],
    "total_files": 2,
    "total_size_bytes": 1048576,
    "entries": [
      {
        "original_path": "C:\\Users\\demo\\workspace\\document_report_abc12345.pdf",
        "name_in_package": "document_report_abc12345.pdf",
        "size_bytes": 524288,
        "tags": ["document", "report"],
        "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        "original_path": "C:\\Users\\demo\\workspace\\document_report_finance_def67890.xlsx",
        "name_in_package": "document_report_finance_def67890.xlsx",
        "size_bytes": 524288,
        "tags": ["document", "report", "finance"],
        "checksum_sha256": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a"
      }
    ]
  },
  "errors": []
}
```

### 5.4 Response — 无匹配文件

```json
{
  "status": "success",
  "zip_path": "C:\\Users\\demo\\Desktop\\exports\\q1_reports.zip",
  "manifest": {
    "created_at": "2026-05-12T08:30:02.000000",
    "tag_filter": ["nonexistent_tag"],
    "total_files": 0,
    "total_size_bytes": 0,
    "entries": []
  },
  "errors": []
}
```

### 5.5 Zip 内部结构

```
q1_reports.zip
├── document_report_abc12345.pdf
├── document_report_finance_def67890.xlsx
└── manifest.json          ← ExportManifest 序列化
```

---

## 6. Interface: Settings / Workspace

### 6.1 触发时机

前端启动时调用 GET 获取当前整理篮路径（用于 UI 展示）。
用户在设置面板中修改整理篮路径时调用 POST 更新。

### 6.2 GET /settings/workspace — 查询当前路径

```
GET /settings/workspace
```

**Response:**

```json
{
  "status": "success",
  "workspace_root": "C:\\Users\\demo\\Documents\\AIDropzone_Workspace",
  "exists": true
}
```

### 6.3 POST /settings/workspace — 修改路径

```
POST /settings/workspace
```

**Request:**

```json
{
  "new_path": "D:\\MyArchive\\Dropzone"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `new_path` | `string` | yes | 新的整理篮绝对路径（或相对项目根目录的路径） |

**Response — 成功:**

```json
{
  "status": "success",
  "workspace_root": "D:\\MyArchive\\Dropzone",
  "message": "Workspace updated to 'D:\\MyArchive\\Dropzone'"
}
```

**Response — 失败（权限不足）:**

```json
{
  "status": "failure",
  "workspace_root": "",
  "message": "Directory is not writable: 'D:\\MyArchive\\Dropzone': ..."
}
```

> 后端在持久化前会验证目录的读写权限（写入 sentinel 文件并清理）。验证通过后
> 立即更新 `config.json` 中的 `workspace_root` 字段，所有后续的 `/rename` 和
> `/export` 操作都会自动使用新路径。

### 6.4 GET /settings/llm — 查询 LLM 配置

```
GET /settings/llm
```

**Response:** API Key **强制脱敏**（仅显示首 4 + 末 4 位，中间以 `*` 填充）：

```json
{
  "status": "success",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "api_key_masked": "AI_D***********_KEY",
  "api_key_env": "AI_DROPZONE_API_KEY",
  "timeout_seconds": 30,
  "max_retries": 3
}
```

### 6.5 POST /settings/llm — 修改 LLM 配置

```
POST /settings/llm
```

**Request:** 只传需要修改的字段：

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "sk-1234567890abcdef1234567890abcdef",
  "timeout_seconds": 60
}
```

**Response — 成功:** 同样对 key 脱敏：

```json
{
  "status": "success",
  "provider": "openai",
  "model": "gpt-4o",
  "api_key_masked": "sk-1***************************cdef"
}
```

---

## 7. Interface: Tag Library

### 7.1 触发时机

前端启动或用户进入标签面板时，调用此接口获取完整的标签库（所有已使用标签及其关联文件数）。

### 7.2 GET /tags — 查询完整标签库

```
GET /tags
```

**Response:**

```json
{
  "status": "success",
  "workspace_root": "D:\\HCI_Course_Design-AIDropzone\\workspace",
  "total_files": 42,
  "tags": {
    "assignment": 5,
    "career": 2,
    "coursework": 8,
    "finance": 3,
    "job": 4,
    "proof": 2,
    "sensitive": 1
  }
}
```

> 标签与文件名的映射存储在 `workspace_root/tags_index.json` 中，
> 实现了"标签索引"与"文件命名"的解耦，避免 MAX_PATH 限制。

---

## 8. Error Handling Convention

所有接口遵循统一的错误模式：

```json
{
  "status": "failure",
  "data": null,
  "error": "Human-readable error description"
}
```

- **永远不会**让未捕获异常传播到调用方。
- 网络/磁盘 I/O 错误、文件不存在、权限不足等全部被 `try-except` 包裹，转为上述结构。
- 批量接口中，单条失败不会中断整批——失败的进 `errors` 数组，成功的正常返回。

---

## 9. Data Flow Summary

```
[设置整理篮路径]
    │
    ▼
  POST /settings/workspace ──── 验证 & 持久化 workspace_root
    │
[拖拽文件]
    │
    ▼
  POST /parse  ────  AI 解析（Mock / Real LLM）+ 敏感文件拦截
    │
    ▼
[前端展示解析结果 & 用户确认]
    │
    ▼
  POST /rename ────  跨目录 move 至 workspace（先写回滚日志）
    │                 ★ 原文件从桌面/原位置消失，归入整理篮
    │
    ├── 用户满意 → POST /export ──── 从 workspace 筛选标签 → 打包 .zip
    │                     │
    │                     ▼
    │                POST /undo ──── 撤销导出（删除 zip）
    │
    └── 用户不满意 → POST /undo ──── 撤销重命名（从 workspace 搬回原处）
```
