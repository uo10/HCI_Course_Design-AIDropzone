# AI Dropzone — 前端

悬浮窗桌面端（Electron）+ React。

> **第一次配置环境、双窗口完整启动** → 仓库根目录 **[SETUP.md](../SETUP.md)**

| 你想做什么 | 看哪一节 |
|------------|----------|
| 没开后端，答辩演示 | [模式 A：Mock 桌面](#模式-a-mock-桌面演示) |
| **桌面 + 真改名/导出/撤销（完整功能）** | **[模式 B：完整桌面 `electron:dev:full`](#模式-b-完整桌面推荐)** |
| 手动配 `.env.local` 联调 | [模式 C：HTTP 手动配置](#模式-chttp-手动配置) |
| 桌面窗太小/看不见 | [常见问题](#常见问题) |
| 打 exe | [打包答辩程序](#打包答辩程序) |

### 三种启动命令区别（重要）

| 命令 | API | 磁盘真改名/导出 | 适用 |
|------|-----|-----------------|------|
| `npm run electron:dev:panel` | **Mock** | 否（模拟） | 答辩录屏、只看 UI |
| **`npm run electron:dev:full`** | **HTTP → 后端** | **是** | **你要的完整功能桌面版** |
| `npm run dev` | Mock | 否 | 仅浏览器调 UI |

---

## 第一次使用（必做）

在 **PowerShell** 里：

```powershell
cd D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm install
```

后续所有 `npm run …` 都在 **`frontend/`** 目录下执行。

---

## 模式 A：Mock 桌面演示

适合录屏、课堂演示：**不启动 Python**，解析/改名/导出/撤销都在内存里模拟（界面顶部会显示黄色「演示模式」条）。

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run electron:dev:panel
```

---

## 模式 B：完整桌面（推荐）

**真功能**：Electron 拖真实文件 + 后端 HTTP → 真解析、真改名、真导出、真撤销。  
需要 **两个 CMD 窗口**。

### 窗口 1：后端（仓库根目录，保持运行）

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

8000 若报 `WinError 10013`，改用 8765，并编辑 `frontend\.env.full` 里 `VITE_API_BASE=http://127.0.0.1:8765`。

### 窗口 2：完整功能桌面

```cmd
cd /d D:\HCI_teamwork\HCI_Course_Design-AIDropzone\frontend
npm run electron:dev:full
```

- 自动读取 `frontend/.env.full`（`VITE_USE_MOCK=false`）  
- 启动后顶部为绿色 **「完整模式（HTTP）」**；若后端未开，会 Toast 提示连接失败  
- **不要**再单独运行 `npm run dev`  
- 从资源管理器 **拖真实文件** 进窗口 → AI 解析 → 预览/确认改名

---

## 模式 A 补充：悬浮球

### 启动桌面端（贴边球，易误以为没启动）

```cmd
npm run electron:dev
```

### 2. 或：默认悬浮球模式

```powershell
npm run electron:dev
```

- 贴边 **悬浮球**（52px）：移入滑出、拖动吸附、**单击**打开大窗  
- 大窗 **◢** 收起到球，**×** 关闭  

### 3. 界面里操作

1. 点 **「加载演示数据」**  
2. 选处理模式 → 预览改名 → 确认（可选撤销）  
3. 或把文件拖到窗口（Electron 会读真实路径）

### 4. 仅调试 UI（浏览器，无真拖放）

```powershell
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，用 **「模拟拖入」** 按钮。

---

## 模式 C：HTTP 手动配置

与 `electron:dev:full` 相同能力，但自己维护 `.env.local`：

### 步骤总览

```
终端 1（仓库根目录）→ 启动后端 uvicorn :8000
终端 2（frontend/）  → 配置 .env.local + npm run electron:dev:panel
```

### 1. 启动后端（在仓库根目录，不是 frontend 里）

```powershell
cd D:\HCI_teamwork\HCI_Course_Design-AIDropzone
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

看到 `Uvicorn running on http://127.0.0.1:8000` 即成功。  
接口文档：`http://127.0.0.1:8000/docs`

> 重命名/导出会动磁盘，测试文件路径要真实存在；导出会扫 `backend/workspace`（可按 `backend/config.json` 准备测试文件）。

### 2. 配置前端走 HTTP

```powershell
cd frontend
Copy-Item .env.example .env.local
```

编辑 `frontend/.env.local`：

```env
VITE_USE_MOCK=false
VITE_API_BASE=http://127.0.0.1:8000
```

改完后**重新启动** `npm run electron:dev:panel`（Vite 只在启动时读环境变量）。

### 3. 先快速测接口是否通（可选）

后端已启动时，在 `frontend/`：

```powershell
npm run test:api
# 或显式指定地址：
node scripts/test-api.mjs http://127.0.0.1:8000
```

rename 测试需要本机真实文件，可设：

```powershell
$env:TEST_FILE = "C:\你的路径\test.png"
npm run test:api
```

### 4. 启动前端桌面端

```powershell
npm run electron:dev:panel
```

联调检查清单：

1. 拖入文件 → 卡片有解析结果  
2. **预览改名**（`dry_run: true`）→ 显示后端返回的 `old` / `new` 路径  
3. **确认改名**（`dry_run: false`）→ 磁盘文件名变化  
4. **导出** → Toast 显示 zip 路径  
5. **撤销** → 路径恢复或 Toast 提示  

### 5. 只测 Python 模块、不测 HTTP（可选）

在**仓库根目录**：

```powershell
pip install pydantic
$env:TEST_FILE = "C:\你的真实路径\test.png"
python frontend/scripts/smoke_backend.py
```

或在 `frontend/`：`npm run test:backend`

---

## Mock 与 HTTP 怎么切换

| 模式 | `.env.local` | 行为 |
|------|----------------|------|
| **Mock（默认）** | 不建文件，或 `VITE_USE_MOCK=true` | `MockApiClient`，内存模拟 |
| **HTTP** | `VITE_USE_MOCK=false` + `VITE_API_BASE=http://127.0.0.1:8000` | `HttpApiClient`，`fetch` 四个 POST |

`src/api/client.ts` 规则：

- `VITE_USE_MOCK=true` / `1` → 强制 Mock  
- `VITE_USE_MOCK=false` / `0` → 强制 HTTP  
- 未设置：有 `VITE_API_BASE` 则用 HTTP，否则 Mock  

默认基址（未写 `VITE_API_BASE` 但关了 Mock 时）：`http://127.0.0.1:8000`（与 `backend/main.py` 里 uvicorn 端口一致）。

---

## 命令一览

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖（首次） |
| `npm run dev` | 浏览器调试 UI（`http://127.0.0.1:5173`） |
| `npm run electron:dev` | Electron + 默认**悬浮球** |
| `npm run electron:dev:panel` | Electron + 大面板 + **Mock 演示** |
| **`npm run electron:dev:full`** | Electron + 大面板 + **HTTP 完整功能**（需后端） |
| `npm run test:api` | 测四个 POST（默认 `http://127.0.0.1:8000`） |
| `npm run test:backend` | 直接调 Python 模块（无 HTTP） |
| `npm run build` | 构建 `dist/` |
| `npm run build:electron` | 编译主进程 `dist-electron/*.cjs` |
| `npm run dist` | 打包 portable exe |
| `npm run lint` | ESLint |

---

## 打包答辩程序

```powershell
cd frontend
npm run dist
```

产物目录：`frontend/release/`（例如 `AI Dropzone 0.1.0.exe`）。

答辩若只用 Mock，可不启后端；若演示真改名/导出，需先启后端并配置 `.env.local` 后再打包（打包前 `VITE_*` 会写入构建结果）。

---

## 常见问题

### 只有浏览器、没有 Electron 桌面窗？

1. **不要**再单独运行 `npm run dev`。桌面开发只用一条命令：`npm run electron:dev:panel`（它会自己起 Vite）。  
2. 若之前开过 `npm run dev`，先在对应 CMD 里 **Ctrl+C** 停掉，否则会占 5173 端口，Electron 链会失败。  
3. **不要**手动打开 `http://127.0.0.1:5173`——那是内嵌页面；成功时会有**独立桌面窗口**（标题栏可拖动、无边框深色面板）。  
4. 仍无窗时，看 CMD 是否在 `build:electron` 之后有报错；可手动试：
   ```cmd
   cd frontend
   npm run build:electron
   node scripts/run-electron.cjs --panel
   ```
   （需另开窗口先 `npm run dev`，或等 `electron:dev:panel` 里 Vite 已就绪。）

### 运行 `electron:dev` 好像没窗口？

默认是 **贴边悬浮球**（窗口只有 52px，贴边只露出一条）。请改用：

```cmd
npm run electron:dev:panel
```

### `npm run test:api` 连不上？

1. 后端是否在跑：`uvicorn backend.main:app --host 127.0.0.1 --port 8000`  
2. 地址是否为 **8000**（不是 8765）  
3. 防火墙是否拦截本机 `127.0.0.1`

### 改了 `.env.local` 没生效？

必须**关掉**正在跑的 Vite/Electron，再重新 `npm run electron:dev:panel`。

### HTTP 预览改名失败「Source file not found」？

`rename` 需要 **磁盘上真实存在的** `source_path`；浏览器「模拟拖入」的路径是假的，请用 Electron 拖入真文件，或把文件放进 `backend/workspace` 再测。

---

## 架构纪律

- 组件 **禁止** `fetch` / `getClient()`  
- 状态与 API 仅在 `useFilePipeline`  
- 改名：`dry_run: true` 预览 → `dry_run: false` 确认  
- HTTP 撤销：先 `undo`，成功用 `undone[]` 回写卡片；失败用本地快照  

产品与前端协作说明见 [`frontend_note/AI_Dropzone_产品方向.md`](frontend_note/AI_Dropzone_产品方向.md)（v2 方向 C + C2，**尚未按该文档改代码**）。
