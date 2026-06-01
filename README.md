# AI Dropzone — Windows Desktop Backend

基于 Python 的 Windows 桌面后台服务，接收拖拽文件并通过 AI 智能分类、重命名、标签打包导出。

> **新手环境与完整启动流程（前后端）** → 请看 **[SETUP.md](./SETUP.md)**  
> **前端桌面 / Mock / 完整功能** → 请看 **[frontend/README.md](./frontend/README.md)**

## 快速开始

```bash
# 1. 进入项目目录
cd D:\HCI_Course_Design-AIDropzone

# 2. 创建并激活虚拟环境
python -m venv venv
venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动 FastAPI 开发服务器
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## 本地调试

启动后访问 Swagger UI 交互式文档，可直接在浏览器中测试全部接口：

```
http://127.0.0.1:8000/docs
```

OpenAPI Schema：`http://127.0.0.1:8000/openapi.json`

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/parse` | AI 文件解析（含敏感词拦截） |
| POST | `/parse/batch` | 批量 AI 解析 |
| POST | `/rename` | 文件重命名（支持 dry-run 预览） |
| POST | `/undo` | 撤销操作（回滚重命名/导出） |
| POST | `/export` | 标签打包导出为 .zip |

## 文档

- **[环境配置与新手流程 SETUP.md](./SETUP.md)** — Python/Node、`.env`、端口、双窗口启动
- [API 接口契约](./backend/API_CONTRACT.md) — 请求/响应 JSON 示例与字段说明
- [后台架构总结](./backend/ARCHITECTURE.md) — 核心机制与安全设计
- [前端 README](./frontend/README.md) — Electron 命令与联调
