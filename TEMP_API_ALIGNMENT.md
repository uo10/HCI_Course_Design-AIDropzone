# 前后端接口对齐清单（临时）

## 背景
前端当前调用层已实现以下能力，但后端现有路由不足，导致设置、日志、按条撤销不可用。  
需要补齐接口并统一请求/响应结构。

---

## 1) `GET /config`
### 功能
读取后端当前运行配置，供前端设置页初始化。

### 请求
- Method: `GET`
- Body: 无

### 响应（建议）
```json
{
  "config": {
    "workspace_root": "D:\\HCI_teamwork\\HCI_Course_Design-AIDropzone\\backend\\workspace",
    "ai_parser": "mock",
    "ai_parser_options": {
      "llm": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com",
        "api_key_set": true,
        "api_key": "sk-****abcd"
      }
    }
  }
}
```

### 前端响应逻辑
- 读取 `workspace_root`、`ai_parser`、`ai_parser_options.llm` 回填设置页。
- 若接口失败：显示“后端未连接”，继续使用本地缓存。

---

## 2) `PUT /config`
### 功能
保存设置页修改后的配置到后端。

### 请求
- Method: `PUT`
- Body（按需字段）：
```json
{
  "workspace_root": "D:\\MyWorkspace",
  "ai_parser": "llm",
  "llm_provider": "deepseek",
  "llm_model": "deepseek-chat",
  "llm_base_url": "https://api.deepseek.com",
  "llm_api_key": "sk-xxxxxxxx"
}
```

### 响应（建议）
```json
{
  "config": {
    "workspace_root": "D:\\MyWorkspace",
    "ai_parser": "llm",
    "ai_parser_options": {
      "llm": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com",
        "api_key_set": true,
        "api_key": "sk-****abcd"
      }
    }
  }
}
```

### 前端响应逻辑
- 成功：提示“保存成功”，刷新 UI 状态。
- 失败：显示错误信息；若用户输入了 key，保留本地缓存并提示后端写入失败。

---

## 3) `GET /journal`
### 功能
返回操作日志列表，供日志页展示。

### 请求
- Method: `GET`
- Body: 无

### 响应（建议）
```json
[
  {
    "entry_id": 12,
    "operation": "rename",
    "timestamp": "2026-06-01T02:35:20.123456",
    "original_path": "C:\\Users\\xx\\Desktop\\a.pdf",
    "new_path": "C:\\Users\\xx\\Desktop\\finance_20260601_a.pdf",
    "tags_snapshot": ["finance"],
    "metadata": {}
  }
]
```

### 前端响应逻辑
- 按现有映射转换为 `ActivityLogEntry`。
- `timestamp` 按 UTC 处理（无时区时补 `Z`）。
- 失败时展示“加载日志失败”。

---

## 4) `POST /undo`（扩展支持 `entry_ids`）
### 功能
支持两种撤销方式：
1. 按最近 N 条撤销（现有能力）  
2. 按指定日志 ID 精确撤销（前端需要）

### 请求
- Method: `POST`
- Body（二选一）：

按 ID：
```json
{
  "entry_ids": [12]
}
```

按数量：
```json
{
  "count": 1,
  "filter_operation": "rename"
}
```

### 响应（建议）
```json
{
  "status": "success",
  "undone": [
    {
      "entry_id": 12,
      "operation": "rename",
      "timestamp": "2026-06-01T02:35:20.123456",
      "original_path": "C:\\Users\\xx\\Desktop\\a.pdf",
      "new_path": "C:\\Users\\xx\\Desktop\\finance_20260601_a.pdf",
      "tags_snapshot": ["finance"],
      "metadata": {}
    }
  ],
  "failed": [],
  "remaining_log_size": 23
}
```

### 前端响应逻辑
- 当前“撤销某一条”走 `entry_ids`，依赖该能力。
- 若 `failed` 非空，展示失败原因。
- 成功后刷新日志与文件状态。

---

## 5) 前端已存在的其余接口（已对齐）
以下接口前后端当前可用，不需新增：
- `POST /parse`
- `POST /parse/batch`
- `POST /rename`
- `POST /export`

---

## 联调验收标准
1. 设置页打开能读取后端配置（`GET /config`）。  
2. 设置页保存后重启后端仍生效（`PUT /config`）。  
3. 日志页可显示后端真实日志（`GET /journal`）。  
4. 点击某一条日志“撤销”只影响该条（`POST /undo` + `entry_ids`）。  
5. 旧逻辑 `count + filter_operation` 仍可用（兼容）。
