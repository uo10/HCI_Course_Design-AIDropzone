# AI Dropzone — 产品方向（v2 · 方向 C + C2）

> **本文档取代** 原 `AI_Dropzone_01～05` 五份笔记，作为唯一的产品与前端协作说明。  
> 环境安装与启动 → 仓库根目录 [`SETUP.md`](../../SETUP.md)  
> 接口字段权威 → [`backend/API_CONTRACT.md`](../../backend/API_CONTRACT.md)（v2 导出扩展待契约更新）  
> **当前阶段：已定方向，尚未按本文改代码。**

---

## 1. 我们要解决什么问题

用户从**很多渠道**拿到零散文件（下载、邮件附件、U 盘、桌面截图等），不想学文件夹结构，只想：

1. **拖进一个入口**
2. （可选）看一下建议名 / 标签，改不改随你
3. **打成一个 zip 带走**
4. （可选）**删掉已打包的源文件**，不用再回各个目录一个个找

一句话：**多渠道捞文件 → 整理篮里过一遍 → 打包带走 → 可选清理。**

---

## 2. 产品定位（HCI）

| 是 | 不是 |
|----|------|
| 桌面悬浮「临时文件整理篮」 | 全盘文件管理器 |
| 会话内可见的文件清单 | 隐藏的 `backend/workspace` + 文件名猜标签 |
| 标签用于筛选、分类（界面概念） | 把标签塞进文件名再用 grep 找 |
| 导出前告诉用户「将打包 N 个文件」 | 空 zip 仍显示成功、打开才知道 |

**原则（答辩可讲）：**

- AI 只建议，用户可关隐私 / Mock
- 默认不传文件正文，只传元数据
- 破坏性操作（删除）必须 **opt-in + 二次确认 + 列表**

---

## 3. 与 v1 实现差异（为何改方向）

v1 已跑通但存在**概念分裂**（HCI 反思可写进报告）：

| v1 行为 | 用户直觉 | 问题 |
|---------|----------|------|
| 拖入可从任意路径 | 「软件接管了这些文件」 | 导出只扫 `workspace`，桌面改好的文件 **打不进 zip** |
| 卡片上有多个 `tags` | 「标签是分类」 | 改名模板只写 **1 个** `{tag}` 进文件名；导出却要文件名里 **AND 满足多标签** |
| 导出扫文件名 `_` 分段 | 「按我选的标签导出」 | 与卡片标签 **无稳定映射** → 空 `manifest` |

v2 方向 **C + C2** 不再以「文件名 token + 隐藏 workspace」为主路径。

---

## 4. 方向 C + C2 定义

### 方向 C：按「会话真实路径」打包

- 导出依据：**本次会话里登记的文件路径**（`file_paths[]`），或 UI 勾选/筛选后的路径列表。
- **不再**以「仅在 workspace 根目录 + 文件名含标签」作为唯一导出手段（可作兼容降级，非主路径）。

### C2：拖入即进入「整理篮」

- 用户从任意处拖入 → 系统 **复制**（首版推荐 copy，比 move 安全）到用户可理解的**整理篮目录**。
- 后续 parse / rename / export / 可选删除，都针对**篮内路径**。
- 整理篮路径：对用户显示为「整理篮」，技术实现可配置（如 `Documents/AI Dropzone Inbox`，与 `backend/config.json` 的 `workspace_root` 对齐时需团队约定）。

```mermaid
flowchart TD
  sources [多渠道文件]
  drop [拖入悬浮窗]
  copy [复制到整理篮 C2]
  session [会话清单可见]
  parse [可选 parse]
  rename [可选 rename 短文件名]
  filter [按标签筛选卡片]
  export [export 按 path 列表打 zip]
  optDelete [可选删除已打包源文件]
  sources --> drop --> copy --> session --> parse --> rename --> filter --> export --> optDelete
```

---

## 5. 核心用户流程（目标态）

1. **拖入** → 复制到整理篮 → 卡片出现在「本次 N 个文件」列表  
2. **选模式**：仅暂存 / 手动 / AI 辅助  
3. **（可选）解析** → 建议名、标签、敏感提示  
4. **（可选）改标签** → 标签存在**会话元数据**，不强迫全部进文件名  
5. **（可选）预览/确认改名** → 篮内短文件名，可读  
6. **按标签筛选** → 只影响「哪些卡片参与导出」（内存筛选）  
7. **导出** → 预览「将打包 N 个文件」→ 选输出目录 → 生成 zip  
8. **（可选）** 勾选「打包成功后删除源文件」→ 二次确认列表 → 删除**本次打进 zip 的篮内文件**  

Mock 模式：同上流程，数据与删除在内存模拟。

---

## 6. 标签在 v2 里是什么

| 层级 | 语义 |
|------|------|
| **UI 标签** | 卡片上的分类，可多选，用于筛选、聚合展示 |
| **文件名** | 给人看的短名字，**不**承担「导出搜索引擎」职责 |
| **导出筛选** | 先按 UI 标签筛出卡片 → 得到 `file_paths[]` → 再打包 |

**禁止再让用户以为：**「勾了 3 个标签，文件名里就必须有 3 个英文单词。」

---

## 7. 导出与「打包后删除」（已选方案）

### 7.1 导出

- 请求携带：`file_paths`（主）、`output_dir`、`package_name`、`include_manifest`。
- 响应必须能反映 `manifest.total_files`；**N=0 时前端禁止提交或强提示**（v1 已部分提示，v2 收紧）。
- zip 内除文件外可有 `manifest.json`（记录真实路径、标签快照、校验和）。

### 7.2 打包后删除（opt-in）

- 导出对话框：**默认不勾选**「打包成功后删除源文件」。
- 勾选后：**第二次确认**，列出将删除的绝对路径。
- 仅删除**本次成功写入 zip 的文件**（篮内那份）。
- v1 删除后**不做 undo**（可写进 future work：回收站）；文案须写明风险。

### 7.3 契约扩展（待后端，本文仅规划）

`POST /export` 拟增加字段（以团队更新 `API_CONTRACT.md` 为准）：

```json
{
  "file_paths": ["C:\\Users\\...\\Inbox\\a.png"],
  "tags": ["private"],
  "output_dir": "C:\\Users\\...\\Desktop\\exports",
  "package_name": "takeaway",
  "include_manifest": true,
  "delete_sources_after_export": false
}
```

- `file_paths` 非空：按路径打包（方向 C）。
- `tags`：由前端用会话数据解析为 path 列表，**非**文件名 grep。
- `delete_sources_after_export`：见 §7.2。

---

## 8. 前端职责与代码规范（保留 v1 有效部分）

### 8.1 边界

| 必须 | 禁止 |
|------|------|
| 只改 `frontend/`（v2 契约扩展需后端改 `backend/` 时，前后端协同） | 在 React 渲染进程直接 `fs` 删用户文件（删除走后端 API） |
| 组件不 `fetch`；`useFilePipeline` 唯一调 `getClient()` | 组件里到处 `any` |
| Mock / Http 双客户端 | 在 `electron` 里写 parse/rename/标签业务 |

### 8.2 分层

```
用户 → components（展示）
     → hooks/useFilePipeline（状态、API）
     → api/client（Mock | Http）
     → 后端 HTTP

拖入 → electron IPC 路径 → 复制到整理篮（v2 待实现）→ FileMetadata
```

### 8.3 环境变量

| 变量 | 作用 |
|------|------|
| `VITE_USE_MOCK` | 强制 Mock |
| `VITE_API_BASE` | 如 `http://127.0.0.1:8000` |

完整启动见 [`frontend/README.md`](../README.md)、[`SETUP.md`](../../SETUP.md)。

### 8.4 现有组件在 v2 下的映射

| 组件 | v2 职责 |
|------|---------|
| `Dropzone` | 拖入；触发**入库复制**（待实现） |
| `FileCard` / `TagEditor` | 展示与编辑**会话标签** |
| `TagAggregator` | 内存筛选，不调 API |
| `ExportDialog` | 传 `file_paths`、预检 N、opt-in 删除 + 确认 |
| `OperationLog` / 撤销 | 改名撤销；删除是否 undo 待定 |
| `DemoMode` | 无后端答辩演示 |

---

## 9. 实施阶段（未开始，仅排期）

| 阶段 | 内容 | 负责 |
|------|------|------|
| P0 | 契约 + 后端 `export` 支持 `file_paths` + 按路径打包 | 后端 |
| P0 | 前端导出传会话 paths、N=0 拦截 | 前端 |
| P1 | 拖入 copy 到整理篮 + UI 显示篮路径 | 前端 + Electron；路径与 `config.json` 对齐 |
| P1 | 导出 opt-in 删除 + 二次确认；后端删除或 `/cleanup` | 前后端 |
| P2 | 标签与文件名解耦（侧车索引或会话 store） | 视工期 |
| P2 | 更新 `SETUP`、答辩稿、HCI 反思页 | 文档 |

**在 P0 完成前，现有 v1 行为仍可能表现为 workspace 空 zip；属预期。**

---

## 10. 答辩叙事建议

1. **问题**：临时文件多渠道、用户不愿管目录。  
2. **v1 教训**：文件名当数据库、隐藏 workspace → 心理模型断裂（可做录屏对比）。  
3. **v2 方案**：整理篮 C2 + 会话路径导出（方向 C）+ 可选打包后清理。  
4. **HCI**：可见性（N 个文件）、错误预防（0 文件不提交）、用户控制（默认不删）。  

---

## 11. 相关文档索引

| 文档 | 用途 |
|------|------|
| [SETUP.md](../../SETUP.md) | 环境、启动、常见问题 |
| [frontend/README.md](../README.md) | npm 命令、Mock / 完整桌面 |
| [backend/API_CONTRACT.md](../../backend/API_CONTRACT.md) | 接口 JSON（随 v2 更新） |
| [backend/ARCHITECTURE.md](../../backend/ARCHITECTURE.md) | 后端机制（回滚等） |

---

*本文档随方向 C 落地迭代；代码未改前，以仓库实际行为为准，以本文为目标态。*
