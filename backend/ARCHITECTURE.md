# 后台逻辑与架构总结 — AI Dropzone

## 整体架构

```
┌─────────────────────────────────────────────────┐
│                    前端 (GUI)                     │
│              拖拽 → 预览 → 确认 → 导出             │
└──────────────────────┬──────────────────────────┘
                       │ JSON (Pydantic 强校验)
┌──────────────────────▼──────────────────────────┐
│                 后台 (Python 3.11+)               │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ AI 解析   │  │ 文件重命名 │  │ 标签打包导出  │   │
│  │ Mock/LLM │  │ + 回滚日志 │  │ + 回滚挂钩   │   │
│  └──────────┘  └─────┬────┘  └──────┬───────┘   │
│                      │              │            │
│                 ┌─────▼──────┐       │            │
│                 │ 回滚日志    │◄──────┘            │
│                 │ (rollback  │                    │
│                 │  _log.json)│                    │
│                 └────────────┘                    │
└──────────────────────────────────────────────────┘
```

四大模块各司其职：AI 解析识别文件内容与标签，重命名模块按模板改写文件名并将旧路径写入回滚日志，导出模块按标签筛选文件并打包为 zip，回滚模块提供任意时刻的撤销能力。

---

## 核心机制一：HAX 容错回滚（先记录，后执行）

> **HAX** = "Habitual Action eXecution with rollback" — 所有破坏性操作在真正执行前，必须先写好回滚记录。

### 设计理念

普通文件管理工具的"撤销"通常是事后补救（从回收站恢复、靠文件系统快照）。而 AI Dropzone 的每一步文件变更都在 **执行前** 写入结构化日志，形成一条可回放的审计链。

### 实现细节

```
用户确认重命名
      │
      ▼
rename_files(request)
      │
      ├─ 1. _build_plan()       ← 计算新路径（纯内存，不动磁盘）
      │
      ├─ 2. record_operation()  ← ★ 先写回滚日志
      │     {
      │       "entry_id": 12,
      │       "operation": "rename",
      │       "original_path": "C:\\...\\photo.jpg",
      │       "new_path": "C:\\...\\image_photo_07338a44.jpg",
      │       "tags_snapshot": ["image", "photo"]
      │     }
      │
      └─ 3. shutil.move()       ← 再执行物理改名
```

**回滚时：**

```
undo_operation({count: 1})
      │
      ├─ 读取 rollback_log.json，取最近 N 条
      ├─ 按时间倒序逐条回放：
      │     rename → shutil.move(new_path → original_path)
      │     export → Path.unlink(zip_path)
      ├─ 成功回滚的条目从日志中删除
      └─ 返回 UndoResult（含 undone / failed / remaining_log_size）
```

### 容错保障

| 场景 | 处理策略 |
|------|----------|
| 目标路径已被占用 | 冲突文件自动重命名为 `.rollback_conflict` 备份 |
| 源文件已不存在 | 该条目记入 `failed`，不阻塞其他条目 |
| 日志 JSON 损坏 | 降级为空日志（丢失历史但系统不崩溃） |
| 并发写入日志冲突 | 原子写入：先写 `.tmp` 再 `replace` |

---

## 核心机制二：Pydantic 强数据校验

### 为什么选择 Pydantic

桌面后台与前端之间的数据契约必须是铁板一块。前端传什么、后端回什么，任何一个字段的类型、范围、格式偏差都可能导致文件误操作或 UI 崩溃。

### 校验层级

```
前端 JSON 载荷
      │
      ▼
Pydantic BaseModel.__init__()
      │
      ├─ 类型强制转换（str → int 自动拒绝）
      ├─ 范围约束（ge / le / min_length / max_length）
      ├─ 正则约束（Tag: /^[a-z0-9_]+$/）
      ├─ 枚举约束（FileCategory / OperationStatus / RenameMode）
      └─ 自定义 validator
      │
      ▼
业务逻辑（此时数据已 100% 可信）
```

### 典型约束示例

| 模型 | 字段 | 约束 |
|------|------|------|
| `FileMetadata` | `size_bytes` | `int, ≥ 0` |
| `Tag` | (string) | `1–64 字符, /^[a-z0-9_]+$/` |
| `RenameRequest` | `items` | `1–500 条` |
| `BatchParseRequest` | `files` | `1–200 条` |
| `UndoRequest` | `count` | `1–100` |
| `ParseItem` | `confidence` | `0.0–1.0` |
| `ExportRequest` | `tags` | `≥ 1 个` |

### 统一错误响应

所有接口的错误不会以异常形式抛出，而是收敛为结构化结果：

```python
class ParseResult(BaseModel):
    status: OperationStatus          # "success" | "failure"
    data: Optional[ParseItem]        # 成功时填充
    error: Optional[str]             # 失败时填充
```

前端只需检查 `status` 字段即可分叉处理，无需 `try-catch`。

---

## 核心机制三：真 LLM 无缝切换接口

### 问题

初期开发和测试阶段使用确定性规则引擎（Mock AI），零成本、零延迟。但产品最终需要接入真实大语言模型（Claude / GPT）来提供非确定性的智能分类和内容摘要。

### 设计：策略模式 + 工厂注入

```
                ┌──────────────────────┐
                │  AIParserInterface   │  ← 抽象基类 (ABC)
                │  parse_file()        │
                │  parse_batch()       │
                └──────┬───────────────┘
           ┌───────────┴───────────┐
           │                       │
  ┌────────▼────────┐    ┌────────▼────────┐
  │  MockAIParser   │    │   LLMParser     │
  │  (确定性规则)    │    │  (Anthropic/    │
  │  零成本零延迟    │    │   OpenAI SDK)   │
  └─────────────────┘    └─────────────────┘
```

### 切换方式

`config.json` 中一行配置即可切换，**零代码改动**：

```json
{
  "ai_parser": "mock",
  "ai_parser_options": {
    "mock": {},
    "llm": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "api_key_env": "AI_DROPZONE_API_KEY",
      "timeout_seconds": 30,
      "max_retries": 3
    }
  }
}
```

### LLM 专用的容错设计

真实 LLM 调用不可靠（网络抖动、API 限流、token 超限），因此 LLMParser 预留了完整的防线：

| 层级 | 措施 |
|------|------|
| **密钥安全** | 从环境变量/Windows Credential Manager 读取，绝不写日志或序列化 |
| **超时控制** | 每次 API 调用有可配置超时（默认 30s） |
| **速率限制** | 遇到 HTTP 429 自动指数退避重试 |
| **成本审计** | 每次调用记录 input/output token 用量 |
| **降级策略** | 重试耗尽后不崩管道，返回 `ParseResult(success=false, error=...)`，调用方可选择降级到 Mock |

---

## 模块交互时序

```
┌────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  前端   │      │ AI 解析   │      │ 文件重命名 │      │ 回滚日志  │
└───┬────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
    │  拖拽文件       │                 │                 │
    │───────────────>│                 │                 │
    │  ParseRequest  │                 │                 │
    │<───────────────│                 │                 │
    │  ParseResult   │                 │                 │
    │                │                 │                 │
    │  用户确认 ─────────────────────>│                 │
    │  RenameRequest                  │                 │
    │                │                 │──record_op()──>│
    │                │                 │  RollbackEntry  │
    │                │                 │<────────────────│
    │                │                 │  (ack)          │
    │                │                 │                 │
    │                │                 │  shutil.move()  │
    │<────────────────────────────────│                 │
    │  RenameResult   │                 │                 │
    │                │                 │                 │
    │  用户不满意 ──────────────────────────────────────>│
    │  UndoRequest    │                 │                 │
    │<──────────────────────────────────────────────────│
    │  UndoResult     │                 │  (文件已还原)    │
```

---

## 目录结构总览

```
backend/
├── config.json                   # 运行时配置（AI 后端选择、命名模板、路径）
├── modules/
│   ├── ai_parser_interface.py    # 抽象基类 (待实现)
│   ├── mock_ai_parser.py         # Mock 解析 — 扩展名分类 + 关键词提取
│   ├── llm_parser.py             # 真 LLM 桩 (待接入)
│   ├── file_renamer.py           # 物理重命名 — 模板引擎 + dry-run
│   ├── rollback.py               # 回滚日志 — 原子写入 + 撤销执行
│   └── tag_exporter.py           # 标签导出 — 索引扫描 + zip 打包
├── models/                       # Pydantic 数据模型
│   ├── common.py                 # FileMetadata, FileCategory, Tag, ErrorDetail
│   ├── parser.py                 # ParseRequest, ParseResult, BatchParseResult
│   ├── renamer.py                # RenameRequest, RenameResult, NamingSchema
│   ├── rollback.py               # RollbackEntry, UndoRequest, UndoResult
│   └── exporter.py               # ExportRequest, ExportResult, ExportManifest
├── utils/                        # 共享工具函数
├── tests/                        # pytest 测试
└── rollback_log.json             # 运行时回滚日志（gitignore）
```

---

## 安全边界

- **文件操作隔离**：所有路径操作限定在 `config.json → workspace_root` 范围内，路径逃逸请求会被拒绝。
- **无 UI 生成**：此后台仓库严格不包含任何前端代码（HTML/CSS/JS/React/Qt/tkinter），仅处理 JSON 数据流。
- **密钥零泄漏**：LLM API Key 仅从环境变量或系统凭据管理器读取，不出现在日志、配置文件或返回载荷中。
- **先记录后执行**：任何破坏性文件操作的前置条件都是成功写入回滚日志。
