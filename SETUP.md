# AI Dropzone — 环境配置与新手完整流程

本文档面向**第一次跑项目**的同学：需要装什么、改哪些配置、按什么顺序启动前后端。  
更细的前端说明见 [`frontend/README.md`](frontend/README.md)，接口字段见 [`backend/API_CONTRACT.md`](backend/API_CONTRACT.md)。

---

## 0. 用户安装（无需 Node / Python / Git）

若你拿到的是 **`AI Dropzone Setup x.x.x.exe`** 安装包（NSIS），按下面步骤即可使用完整功能：

1. 双击安装程序，按向导完成安装（可改安装目录、可创建桌面快捷方式）。
2. 从桌面或开始菜单启动 **AI Dropzone**（无需再开 CMD 或 uvicorn）。
3. 首次启动会自动：
   - 在后台启动内置后端（`127.0.0.1:17823`，无黑窗）；
   - 在 `%APPDATA%\AI Dropzone\config.json` 创建配置（从模板复制）；
   - 默认工作区为 `文档\AI Dropzone Workspace`。
4. 打开 **设置**，填写 **DeepSeek API Key**（不会打进安装包）。
5. 拖入文件 → 解析/改名 → 搜索与打包 → 撤销，与开发联调时一致。

**卸载**：使用「添加或删除程序」中的 AI Dropzone 卸载项。用户配置与 workspace 在 `%APPDATA%\AI Dropzone` 与 `文档\AI Dropzone Workspace`，卸载程序默认不删除，需手动清理。

**SmartScreen**：未签名的安装包可能提示「未知发布者」，答辩/内测可点「仍要运行」。

---

## 0.1 开发者构建安装包

在**已配置 Python venv + Node** 的开发机上，于仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-release.ps1
```

该脚本依次：PyInstaller 打 `backend/dist/aidropzone-server/` → `vite build --mode full` → `build:electron` → `electron-builder`（NSIS）。

产物：`frontend\release\AI Dropzone Setup 0.1.0.exe`（版本号以 `frontend/package.json` 为准）。

**注意**：

- 构建前勿把真实 API Key 写入 `backend/config.json`（该文件已在 `.gitignore`；仓库仅保留 `backend/config.example.json`）。
- 旧命令 `npm run dist` 仍可用，但**不会**自动打 Python 后端；完整安装包请用 `build-release.ps1`。

---

## 1. 项目是做什么的

Windows **桌面悬浮窗**：拖入文件 → AI/Mock 解析与标签 → 预览并确认改名 → 按标签查看 → 导出 zip → 可撤销。

| 部分 | 技术 | 目录 |
|------|------|------|
| 后端 | Python + FastAPI | `backend/` |
| 前端 | React + Vite + Electron | `frontend/` |

前后端通过本机 **HTTP**（`127.0.0.1`）传 JSON；前端也可在 **Mock 模式**下不启后端做答辩演示。

---

## 2. 环境要求

| 软件 | 建议版本 | 用途 |
|------|----------|------|
| **Windows** | 10 / 11 | 目标平台 |
| **Python** | 3.11+ | 后端 |
| **Node.js** | 18 LTS 或 20 LTS | 前端与 Electron |
| **npm** | 随 Node 安装 | 前端依赖 |
| **TypeScript（全局可选）** | 6.0+ | 若要全局 `tsc`；项目本地已锁定 6.x |

> ⚠️ **TypeScript 版本说明**  
> 项目 `frontend/package.json` 中 TypeScript 已锁定 `^6.0.0`。  
> 运行 `npm install` 时项目本地会安装 6.x，与全局版本无关。  
> 若你的全局 `tsc -v` 是旧版本，**不影响项目构建**，`npm run build:electron` 始终使用项目本地 (`npx tsc`)。

检查版本（CMD 或 PowerShell 均可）：

```powershell
python --version
node --version
npm --version
# 确认项目本地 TypeScript 版本（应为 6.x）
cd frontend
npx tsc -v
```

### 2.1 一键环境自检 / 修复（前端）

为避免新同学遇到 Electron 安装损坏、Node 版本不兼容等问题，`frontend` 已内置两个命令：

```powershell
cd D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run env:doctor
npm run env:bootstrap
```

- `env:doctor`：只检查（Node 版本、本地 TypeScript、Electron 可执行文件、build:electron）。  
- `env:bootstrap`：自动清理依赖并重装，修复 Electron 安装；若 Node 不在推荐范围，会提示切换到 Node 20 LTS。

---

## 3. 仓库目录（和配置相关的）

```
HCI_Course_Design-AIDropzone/
├── SETUP.md                 ← 本文档（环境 + 新手流程）
├── README.md                ← 后端快速开始
├── requirements.txt         ← Python 依赖（根目录）
├── backend/
│   ├── main.py              ← HTTP 入口（uvicorn 启动）
│   ├── config.example.json  ← 配置模板（提交 Git）
│   ├── config.json          ← 本地运行时配置（不提交 Git，从 example 复制）
│   ├── API_CONTRACT.md      ← 接口契约（前后端对齐看这个）
│   ├── ARCHITECTURE.md      ← 后端架构说明
│   ├── workspace/           ← 导出扫描目录（需自行准备测试文件，可无则导出为空）
│   └── rollback_log.json    ← 运行后生成的回滚日志（已在 .gitignore）
└── frontend/
    ├── README.md            ← 前端启动与命令
    ├── package.json         ← npm 脚本
    ├── .env.example         ← Mock 环境变量模板
    ├── .env.full            ← 完整功能（HTTP）环境变量（给 electron:dev:full 用）
    ├── .env.local           ← 本地覆盖（需自己创建，不会提交 Git）
    └── frontend_note/       ← 进度与计划（单文档）
```

---

## 4. 配置文件说明（必读）

### 4.1 根目录 `requirements.txt`

```text
pydantic
fastapi
uvicorn[standard]
```

安装命令（在**仓库根目录**）：

```cmd
pip install -r requirements.txt
```

建议使用虚拟环境（可选但推荐）：

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 4.2 后端 `backend/config.json`

首次开发请复制模板：

```cmd
copy backend\config.example.json backend\config.json
```

| 字段 | 含义 |
|------|------|
| `workspace_root` | 导出/整理工作区；空则默认 `~/Documents/AIDropzone_Workspace`（安装包用户为 `~/Documents/AI Dropzone Workspace`） |
| `ai_parser` | `"mock"` 或 `"llm"` |
| `ai_parser_options.llm.api_key` | DeepSeek Key（设置页可写；勿提交 Git） |
| `naming.default_pattern` | 默认改名模板 |
| `rollback.journal_path` | 回滚日志文件名 `rollback_log.json` |

安装包用户：配置在 `%APPDATA%\AI Dropzone\config.json`，由应用首次启动自动创建。

**导出功能**：把已按标签规则改好名的测试文件放进 `backend/workspace/`，导出时才会被打进 zip。

### 4.3 前端环境变量（Vite）

| 文件 | 是否提交 Git | 作用 |
|------|----------------|------|
| `.env.example` | 是 | 模板；Mock 答辩参考 |
| `.env.full` | 是 | `npm run electron:dev:full` 自动加载（`vite --mode full`） |
| `.env.local` | **否**（本地自建） | 覆盖 example，手动 HTTP 联调时用 |

| 变量 | 值 | 含义 |
|------|-----|------|
| `VITE_USE_MOCK` | `true` / `false` | 强制 Mock 或强制 HTTP |
| `VITE_API_BASE` | 如 `http://127.0.0.1:8000` | 后端地址（须与 uvicorn 端口一致） |

逻辑见 `frontend/src/api/client.ts`：未配置时默认 Mock；`VITE_USE_MOCK=false` 时走 `HttpApiClient`。

### 4.4 端口约定（前后端必须一致）

| 端口 | 服务 |
|------|------|
| **8000** | 后端 uvicorn 默认（`backend/main.py` 注释） |
| **5173** | 前端 Vite 开发服务器（仅开发时，给 Electron 内嵌页面用） |
| **8765** | 8000 被系统占用时的备选后端端口 |

若后端改用 **8765**，必须同时改 `frontend/.env.full`（或 `.env.local`）里的 `VITE_API_BASE`。

---

## 5. 首次安装（只做一次）

### 步骤 A：后端依赖

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 步骤 B：前端依赖

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm install
npm run env:doctor
```

### 步骤 C：可选 — 准备导出测试目录

```cmd
mkdir D:\HCI_teamwork\HCI_Course_Design-AIDropzone\backend\workspace
```

把几个已改名、文件名里带标签的文件复制进去（联调导出时用）。

---

## 6. 三种运行方式（选一种）

| 方式 | 要不要开后端 | 前端命令 | 真改名/导出 |
|------|--------------|----------|-------------|
| **答辩 Mock 桌面** | 否 | `npm run electron:dev:panel` | 否（内存模拟） |
| **完整功能桌面** | **是** | `npm run electron:dev:full` | **是** |
| **仅浏览器调 UI** | 否 | `npm run dev` | 否 |

界面顶部横幅：

- 黄色 **演示模式（Mock）** → 未连后端  
- 绿色 **完整模式（HTTP）** → 已配置连后端（仍需后端进程在跑）

---

## 7. 新手推荐：完整功能全流程（两个 CMD 窗口）

**一键启动（Windows）**：双击项目根目录 [`start-dev.bat`](./start-dev.bat)，会自动打开两个 CMD 窗口（后端 + `electron:dev:full`），无需手抄命令。

你已经跑通的话，可按此清单自检；第一次建议严格按顺序做。

### 窗口 1 — 启动后端（保持运行，不要关）

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone
venv\Scripts\activate
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

**成功标志：**

```text
Uvicorn running on http://127.0.0.1:8000
```

浏览器可打开接口文档：`http://127.0.0.1:8000/docs`

**若报错 `WinError 10013`（8000 无法绑定）：**

```cmd
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8765
```

并编辑 `frontend\.env.full`，把最后一行改为：

```env
VITE_API_BASE=http://127.0.0.1:8765
```

### 窗口 2 — 启动完整功能桌面

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run electron:dev:full
```

**注意：**

1. **不要**在同一时间再运行 `npm run dev`（会占用 5173，导致 Electron 启动失败）。  
2. **不要**手动用浏览器打开 `http://127.0.0.1:5173` 当作「桌面版」——完整桌面是 **弹出的 Electron 窗口**。  
3. `electron:dev:full` **不会**替你启动后端；窗口 1 必须先起来。

**成功标志：**

- 弹出独立桌面窗口（深色大面板）  
- 顶部绿色「完整模式（HTTP）」  
- Toast 提示「后端已连接：http://127.0.0.1:8000」

### 在桌面里走一遍业务

1. 从资源管理器 **拖入真实文件**（路径必须在本机存在）  
2. 处理模式选 **AI 辅助**（会调 `POST /parse`）  
3. 查看卡片标签与建议名（文件名含「简历」等会标 `sensitive`）  
4. 点 **预览改名**（`dry_run: true`）→ 核对列表中的旧路径/新路径  
5. 点 **确认改名**（`dry_run: false`）→ 在资源管理器中确认文件名已变  
6. 需要时 **撤销**（`POST /undo`）  
7. **导出**：选标签与输出目录（见下方「导出为什么是空 zip」）

### 可选：命令行快速测后端（第三个 CMD）

后端已启动时：

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run test:api
```

rename 测试需本机真实文件：

```cmd
set TEST_FILE=C:\你的路径\test.png
npm run test:api
```

---

## 8. 答辩专用：不启后端（Mock 桌面）

只需一个窗口：

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run electron:dev:panel
```

操作：点 **「加载演示数据」** → 预览/确认改名 → 撤销（均为模拟，不改磁盘）。

若要贴边悬浮球而不是大面板：

```cmd
npm run electron:dev
```

单击贴边球可展开大窗。

---

## 9. 手动配置 HTTP（不用 `electron:dev:full` 时）

与完整功能相同，但自己维护 `.env.local`：

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
copy .env.example .env.local
```

记事本编辑 `.env.local`：

```env
VITE_USE_MOCK=false
VITE_API_BASE=http://127.0.0.1:8000
```

然后（后端仍须先启动）：

```cmd
npm run electron:dev:panel
```

改 `.env.local` 后必须 **Ctrl+C 重启** 前端进程。

---

## 10. 打包（开发者）

| 目标 | 命令 | 产物 |
|------|------|------|
| **完整 NSIS 安装包**（含 Python 后端） | 根目录 `scripts\build-release.ps1` | `frontend\release\AI Dropzone Setup x.x.x.exe` |
| 仅 Electron 壳（不含后端） | `cd frontend && npm run dist` | 需用户自行启 uvicorn |

完整安装包构建前请确认 `backend/dist/aidropzone-server/` 已由 PyInstaller 生成（`build-release.ps1` 会自动执行）。

- 安装包内后端固定端口 **17823**；开发联调仍用 **8000**（或 `.env.full` 中配置的端口）。
- 打包使用 `vite build --mode full`（`VITE_USE_MOCK=false`），与 `electron:dev:full` 一致。

---

## 11. 导出为什么是空 zip（只有 manifest.json）？

这是**正常现象**，不是导出接口坏了。

| 步骤 | 实际发生的事 |
|------|----------------|
| 拖入 + 确认改名 | 文件在**你拖入时的目录**改名（如桌面 `C:\Users\你\Desktop\...`） |
| 点「导出」 | 后端**不会**去桌面找文件，只扫描 **`backend/workspace/`** 里的文件 |
| 扫描规则 | 看**文件名**里用 `_` 分开的英文标签；勾选多个标签时要**同时包含**（AND） |

因此：桌面改名成功，但 `workspace` 里没有带 `private` 等标签的文件 → `total_files: 0`，zip 里只有 `manifest.json`。

**正确做法（任选其一）：**

1. **答辩推荐**：先把测试文件放进 `backend/workspace`，从该文件夹拖入应用 → 改名 → 再导出。  
2. 改名完成后，把已改名的文件**复制**到 `backend/workspace`，再点导出（文件名需含所选标签，如 `private_20260522_xxx.png`）。  
3. 与后端约定把 `backend/config.json` 的 `workspace_root` 改成你常用的文件夹（需后端改配置）。

契约说明见 `backend/API_CONTRACT.md` §5.4（无匹配文件时仍返回 `success`，`total_files: 0`）。

---

## 12. 常见问题

| 现象 | 处理 |
|------|------|
| 只有浏览器、没有 Electron 窗 | 勿单独 `npm run dev`；用 `electron:dev:panel` 或 `electron:dev:full`；关掉占用 5173 的进程 |
| 窗口只有贴边细条 | 用了 `electron:dev` 默认球模式；改用 `electron:dev:panel` 或 `electron:dev:full` |
| Toast 无法连接后端 | 窗口 1 的 uvicorn 是否在跑；端口与 `.env.full` 是否一致 |
| 改了 `.env.local` 无效 | 必须重启 Vite/Electron（Ctrl+C 后再 `npm run …`） |
| 预览改名 Source file not found | 浏览器模拟路径无效；用 Electron 拖**真实文件** |
| `npm run test:api` 失败 | 先启后端；检查 8000/8765 |
| `Copy-Item` 在 CMD 里报错 | CMD 用 `copy .env.example .env.local` |
| 8000 WinError 10013 | 换端口 8765，前后端配置一起改 |
| Electron failed to install correctly | 在 `frontend/` 执行 `npm run env:bootstrap`，再重试 `npm run electron:dev:full` |

---

## 13. 文档索引（前后端全部）

### 仓库根目录

| 文档 | 内容 |
|------|------|
| [SETUP.md](./SETUP.md) | 本文：环境 + 新手完整流程 |
| [README.md](./README.md) | 后端快速开始、API 路由表 |

### 后端 `backend/`

| 文档 | 内容 |
|------|------|
| [API_CONTRACT.md](./backend/API_CONTRACT.md) | 四个 POST 接口的请求/响应 JSON |
| [ARCHITECTURE.md](./backend/ARCHITECTURE.md) | 回滚、Pydantic、敏感词、模块划分 |
| [config.example.json](./backend/config.example.json) | 配置模板 |
| [main.py](./backend/main.py) | FastAPI 路由与启动说明 |

### 前端 `frontend/`

| 文档 | 内容 |
|------|------|
| [README.md](./frontend/README.md) | 启动命令、Mock/HTTP、打包、FAQ |
| [frontend_note/进度与计划.md](./frontend/frontend_note/进度与计划.md) | 当前进度、环境配置、未来计划（v2 方向 C + C2） |

### 环境变量模板

| 文件 | 说明 |
|------|------|
| [frontend/.env.example](./frontend/.env.example) | Mock 模板 |
| [frontend/.env.full](./frontend/.env.full) | 完整功能 HTTP 配置 |

---

## 14. 一分钟对照表

```
完整功能  =  窗口1: uvicorn (8000 或 8765)
          +  窗口2: cd frontend && npm run electron:dev:full
          +  Electron 拖真文件 + 顶部绿色 HTTP 横幅

Mock答辩  =  仅窗口: npm run electron:dev:panel
          +  「加载演示数据」
          +  无需 uvicorn
```

有问题先查本文 [§11 导出空 zip](#11-导出为什么是空-zip只有-manifestjson) 与 [§12 常见问题](#12-常见问题)，再查 [`frontend/README.md`](frontend/README.md)。
