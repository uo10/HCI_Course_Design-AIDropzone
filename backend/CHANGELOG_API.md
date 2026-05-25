# API 变更简报 — 供前端联调

> **版本**: v1.0 → v1.1  
> **日期**: 2026-05-25  
> **完整契约**: 见 `backend/API_CONTRACT.md`

---

## 一、新增接口（3 个）

| 方法 | 路径 | 用途 |
|------|------|------|
| **GET** | `/tags` | 拉取完整标签库（含每个标签的文件数） |
| **GET** | `/settings/llm` | 查询 LLM 配置（API Key **已脱敏**） |
| **POST** | `/settings/llm` | 修改 LLM 配置（只传需改的字段） |

### GET /tags 响应示例

```json
{
  "status": "success",
  "workspace_root": "D:\\...\\workspace",
  "total_files": 42,
  "tags": {
    "assignment": 5,
    "coursework": 8,
    "finance": 3,
    "job": 4
  }
}
```

前端启动或进入标签面板时调用，用于展示标签云/筛选器。

### GET /settings/llm 响应示例

```json
{
  "status": "success",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "api_key_masked": "sk-1***************************cdef",
  "timeout_seconds": 30,
  "max_retries": 3
}
```

`api_key_masked` 固定为首 4 + `*`×N + 末 4 的格式，**绝不返回明文 Key**。

### POST /settings/llm 请求示例

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "sk-abc123..."
}
```

只传需要修改的字段即可，未传字段保持不变。

---

## 二、行为变更（已存在接口的更新）

### POST /parse — AI 解析引擎升级

**旧行为**: 简单规则匹配，返回固定英文摘要，置信度恒为 0.85。

**新行为**: 多维场景引擎。
- 覆盖三类场景：**课程作业、求职材料、财务证明**
- summary 字段现在包含**思维链（Chain-of-Thought）分析**，格式：

  ```
  [思维链] 文件名包含疑似课程关键词 '大作业'
  → 结合扩展名判断为文档
  → 建议归类为「课程作业」，适用于教学场景归档。
  | 标准文本文档，可用于记录、撰写或编辑文字内容
  ```

- 每次返回 **2–3 个标签**（以前可能只有 1–2 个）
- **置信度动态调整**: 命中场景 0.92，未命中 0.78
- 敏感词拦截（身份证、简历等）照旧工作

> **前端适配**: 解析结果的 `tags` 和 `summary` 字段格式不变，但内容更丰富。
> `confidence` 数值现在有实际区分度，可用于 UI 的信任度指示器。

### POST /rename — 标签不再嵌入文件名

**旧行为**: 文件名包含 `{tag}` 占位符，如 `document_20260512_readme.txt`。

**新行为**: 默认命名模板改为 `{date}_{name}.{ext}`，标签独立存储在
`workspace_root/tags_index.json` 索引中。

**影响**:
- 文件名变短，不会触达 Windows MAX_PATH (260) 限制
- **源文件安全**: 标签信息保存在独立索引，源文件名仅追加日期和哈希
- 旧的 `{tag}` 占位符仍可用（前端若显式指定 pattern 含 `{tag}` 依旧生效）

### POST /export — 基于索引查找（不再是文件名解析）

导出接口现在从 `tags_index.json` 读取标签，不再解析文件名中的标记。
行为对前端透明——请求/响应格式完全不变。

---

## 三、接口全景（v1.1）

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 1 | POST | `/parse` | AI 解析（思维链摘要 + 2-3 标签） |
| 2 | POST | `/parse/batch` | 批量解析 |
| 3 | POST | `/rename` | 跨目录收纳（标签写入独立索引） |
| 4 | POST | `/undo` | 撤销操作 |
| 5 | POST | `/export` | 标签打包导出（基于索引查找） |
| 6 | **GET** | **`/tags`** | **🆕 标签库查询** |
| 7 | GET | `/settings/workspace` | 整理篮路径查询 |
| 8 | POST | `/settings/workspace` | 修改整理篮路径 |
| 9 | **GET** | **`/settings/llm`** | **🆕 LLM 配置查询（Key 脱敏）** |
| 10 | **POST** | **`/settings/llm`** | **🆕 LLM 配置更新** |

---

## 四、前端适配建议

| 优先级 | 事项 |
|--------|------|
| **P0** | 调用 `GET /tags` 替代前端自行维护的标签列表 |
| **P1** | 利用 `summary` 中的 `[思维链]` 内容渲染更丰富的解析卡片 |
| **P1** | 利用 `confidence` 数值做信任度指示（高/中/低） |
| **P2** | `GET /settings/llm` 展示当前模型与脱敏 Key |
| **P2** | `POST /settings/llm` 对接 LLM 配置面板 |
| **无需改动** | `/parse` `/rename` `/export` `/undo` `/settings/workspace` 请求/响应格式不变 |
