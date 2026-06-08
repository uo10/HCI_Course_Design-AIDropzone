import { app, BrowserWindow, ipcMain, screen, shell, type IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { copyFilesToClipboard, cutFilesToClipboard } from './fileClipboard';

const VITE_DEV_URL = 'http://127.0.0.1:5173';
const isDev = !app.isPackaged;

/** 360 式悬浮球：窗口与球同大，贴边时仅露出一条 */
const BALL_SIZE = 56;
/** 拖入靶心胶囊态（P0 morphing） */
const BALL_CAPSULE = { width: 112, height: 64 };
const BALL_PEEK = 16;
/** 窗口中心距工作区边缘小于此值时，松手后贴边缩入；否则保持自由漂浮 */
const BALL_DOCK_THRESHOLD = 52;
/** 与网页 max-w-4xl 双栏详情接近的默认尺寸 */
const PANEL_DEFAULT = { width: 920, height: 680 };
const PANEL_MIN = { width: 720, height: 520 };

type ShellMode = 'ball' | 'panel';
type BallEdge = 'left' | 'right' | 'top' | 'bottom';

interface FileMetadataPayload {
  path: string;
  size_bytes: number;
  extension: string;
  mime_type?: string;
  name_before_drop: string;
}

let mainWindow: BrowserWindow | null = null;
let shellMode: ShellMode =
  process.env.DROPZONE_START_PANEL === '1' ? 'panel' : 'ball';
let savedPanelBounds: Electron.Rectangle | null = null;

let ballEdge: BallEdge = 'right';
/** 贴左右边时为 y，贴上下边时为 x */
let ballAnchor = 0;
let ballDockExpanded = false;
/** true = 桌面任意位置漂浮；false = 已贴边，可 peek/展开 */
let ballFloating = true;
type BallVisualPreset = 'idle' | 'capsule';
let ballVisualPreset: BallVisualPreset = 'idle';

function ballDimensions(): { width: number; height: number } {
  return ballVisualPreset === 'capsule'
    ? { width: BALL_CAPSULE.width, height: BALL_CAPSULE.height }
    : { width: BALL_SIZE, height: BALL_SIZE };
}

function normalizeFilePath(filePath: string): string {
  let p = filePath.trim().replace(/^["']|["']$/g, '');
  if (process.platform === 'win32') {
    p = p.replace(/\//g, '\\');
  }
  return path.normalize(p);
}

async function buildFileMetadata(
  filePath: string,
  hint?: Partial<FileMetadataPayload>,
): Promise<FileMetadataPayload> {
  const resolved = normalizeFilePath(filePath);
  if (!resolved) {
    throw new Error('文件路径为空');
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error('路径指向的不是文件');
    }
    const name_before_drop = path.basename(resolved);
    const extension = path.extname(resolved).slice(1).toLowerCase() || 'unknown';
    return {
      path: resolved,
      size_bytes: stat.size,
      extension,
      mime_type: 'application/octet-stream',
      name_before_drop,
    };
  } catch (statErr) {
    if (hint?.name_before_drop != null && hint.size_bytes != null) {
      try {
        await fs.access(resolved);
      } catch {
        const msg = statErr instanceof Error ? statErr.message : String(statErr);
        throw new Error(`无法访问文件「${resolved}」: ${msg}`);
      }
      return {
        path: resolved,
        size_bytes: hint.size_bytes,
        extension: hint.extension ?? 'unknown',
        mime_type: hint.mime_type ?? 'application/octet-stream',
        name_before_drop: hint.name_before_drop,
      };
    }
    const msg = statErr instanceof Error ? statErr.message : String(statErr);
    throw new Error(`无法读取「${resolved}」: ${msg}`);
  }
}

function notifyShellMode(mode: ShellMode): void {
  mainWindow?.webContents.send('shell:modeChanged', mode);
}

/** 窗口底色必须始终全透明，否则 Win 会在圆角外露出方形色块 */
function ensureWindowTransparent(): void {
  if (!mainWindow) return;
  mainWindow.setBackgroundColor('#00000000');
}

function setWindowBackgroundMaterial(mode: ShellMode): void {
  if (!mainWindow || process.platform !== 'win32') return;
  try {
    /** ball：禁止 DWM 在失焦顶置窗下铺矩形底板；panel：保持系统玻璃 */
    mainWindow.setBackgroundMaterial(mode === 'ball' ? 'none' : 'mica');
  } catch {
    // 旧版 Windows / Electron 可能不支持
  }
}

/** 小球失焦时 Win 易在 56×56 方窗四角显色，需重复声明透明并刷新合成 */
function refreshBallWindowChrome(): void {
  if (!mainWindow || shellMode !== 'ball') return;
  ensureWindowTransparent();
  setWindowBackgroundMaterial('ball');
  mainWindow.setHasShadow(false);
  mainWindow.webContents.invalidate();
}

function notifyWindowFocused(focused: boolean): void {
  if (shellMode !== 'ball') return;
  mainWindow?.webContents.send('shell:windowFocused', focused);
}

function clampBoundsToWorkArea(
  bounds: Electron.Rectangle,
  workArea: Electron.Rectangle,
): Electron.Rectangle {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  let x = bounds.x;
  let y = bounds.y;
  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;
  if (x + width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - width;
  }
  if (y + height > workArea.y + workArea.height) {
    y = workArea.y + workArea.height - height;
  }
  return { x, y, width, height };
}

function workAreaForBall(): Electron.Rectangle {
  if (!mainWindow) return screen.getPrimaryDisplay().workArea;
  const b = mainWindow.getBounds();
  return screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea;
}

function clampBallAnchor(wa: Electron.Rectangle): number {
  const { width, height } = ballDimensions();
  if (ballEdge === 'left' || ballEdge === 'right') {
    const min = wa.y;
    const max = wa.y + wa.height - height;
    return Math.min(max, Math.max(min, ballAnchor));
  }
  const min = wa.x;
  const max = wa.x + wa.width - width;
  return Math.min(max, Math.max(min, ballAnchor));
}

function ballBoundsPeek(wa: Electron.Rectangle): Electron.Rectangle {
  const anchor = clampBallAnchor(wa);
  const { width, height } = ballDimensions();
  switch (ballEdge) {
    case 'right':
      return {
        x: wa.x + wa.width - BALL_PEEK,
        y: anchor,
        width,
        height,
      };
    case 'left':
      return {
        x: wa.x - (width - BALL_PEEK),
        y: anchor,
        width,
        height,
      };
    case 'top':
      return {
        x: anchor,
        y: wa.y - (height - BALL_PEEK),
        width,
        height,
      };
    case 'bottom':
      return {
        x: anchor,
        y: wa.y + wa.height - BALL_PEEK,
        width,
        height,
      };
  }
}

function ballBoundsExpanded(wa: Electron.Rectangle): Electron.Rectangle {
  const anchor = clampBallAnchor(wa);
  const { width, height } = ballDimensions();
  switch (ballEdge) {
    case 'right':
      return {
        x: wa.x + wa.width - width,
        y: anchor,
        width,
        height,
      };
    case 'left':
      return { x: wa.x, y: anchor, width, height };
    case 'top':
      return { x: anchor, y: wa.y, width, height };
    case 'bottom':
      return {
        x: anchor,
        y: wa.y + wa.height - height,
        width,
        height,
      };
  }
}

/** 以当前窗口中心为锚缩放，避免扩为胶囊时跳动 */
function applyBallVisualPreset(preset: BallVisualPreset): void {
  if (!mainWindow || shellMode !== 'ball') return;
  const b = mainWindow.getBounds();
  const { width, height } =
    preset === 'capsule'
      ? { width: BALL_CAPSULE.width, height: BALL_CAPSULE.height }
      : { width: BALL_SIZE, height: BALL_SIZE };
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const wa = screen.getDisplayNearestPoint({ x: cx, y: cy }).workArea;
  const target = clampBoundsToWorkArea(
    {
      x: Math.round(cx - width / 2),
      y: Math.round(cy - height / 2),
      width,
      height,
    },
    wa,
  );
  ballVisualPreset = preset;
  mainWindow.setBounds(target);
  refreshBallWindowChrome();
}

function applyBallBounds(): void {
  if (!mainWindow || shellMode !== 'ball' || ballFloating) return;
  const wa = workAreaForBall();
  const target = ballDockExpanded
    ? ballBoundsExpanded(wa)
    : ballBoundsPeek(wa);
  mainWindow.setBounds(target);
}

/** 松手时：仅当靠近屏幕边缘才贴边缩入，否则保持当前自由位置 */
function maybeDockBallAfterDrag(): void {
  if (!mainWindow || shellMode !== 'ball') return;
  const b = mainWindow.getBounds();
  const wa = screen.getDisplayNearestPoint({
    x: b.x + Math.floor(b.width / 2),
    y: b.y + Math.floor(b.height / 2),
  }).workArea;

  const distLeft = b.x - wa.x;
  const distRight = wa.x + wa.width - (b.x + b.width);
  const distTop = b.y - wa.y;
  const distBottom = wa.y + wa.height - (b.y + b.height);
  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min > BALL_DOCK_THRESHOLD) {
    ballFloating = true;
    return;
  }

  ballFloating = false;
  ballDockExpanded = false;
  if (min === distRight) {
    ballEdge = 'right';
    ballAnchor = b.y;
  } else if (min === distLeft) {
    ballEdge = 'left';
    ballAnchor = b.y;
  } else if (min === distTop) {
    ballEdge = 'top';
    ballAnchor = b.x;
  } else {
    ballEdge = 'bottom';
    ballAnchor = b.x;
  }
  applyBallBounds();
}

function initBallDock(): void {
  if (!mainWindow) return;
  const wa = screen.getPrimaryDisplay().workArea;
  ballFloating = true;
  ballDockExpanded = false;
  const x = wa.x + Math.floor((wa.width - BALL_SIZE) / 2);
  const y = wa.y + Math.floor((wa.height - BALL_SIZE) / 2);
  mainWindow.setBounds({ x, y, width: BALL_SIZE, height: BALL_SIZE });
}

function applyBallMode(): void {
  if (!mainWindow) return;

  if (shellMode === 'panel') {
    savedPanelBounds = mainWindow.getBounds();
  }

  const wa = workAreaForBall();
  const b = mainWindow.getBounds();
  const x = Math.min(
    wa.x + wa.width - BALL_SIZE,
    Math.max(wa.x, b.x + Math.floor((b.width - BALL_SIZE) / 2)),
  );
  const y = Math.min(
    wa.y + wa.height - BALL_SIZE,
    Math.max(wa.y, b.y + Math.floor((b.height - BALL_SIZE) / 2)),
  );

  shellMode = 'ball';
  ballVisualPreset = 'idle';
  /** 必须清空标题，否则 Win 会在 56×56 窗口旁绘制「AI Dropzone」文字条 */
  mainWindow.setTitle('');
  ensureWindowTransparent();
  mainWindow.setResizable(false);
  mainWindow.setMinimumSize(BALL_SIZE, BALL_SIZE);
  mainWindow.setMaximumSize(BALL_CAPSULE.width, BALL_CAPSULE.height);
  ballFloating = true;
  ballDockExpanded = false;
  mainWindow.setBounds({ x, y, width: BALL_SIZE, height: BALL_SIZE });
  /** 小球窗口关闭阴影，减轻 Windows 下拖动时外缘「方框/描边」视觉异常 */
  mainWindow.setHasShadow(false);
  setWindowBackgroundMaterial('ball');
  mainWindow.setAlwaysOnTop(true);
  refreshBallWindowChrome();
  notifyShellMode('ball');
}

function applyPanelMode(): void {
  if (!mainWindow) return;

  const ballRect = mainWindow.getBounds();
  const center = {
    x: ballRect.x + Math.floor(ballRect.width / 2),
    y: ballRect.y + Math.floor(ballRect.height / 2),
  };
  const wa = screen.getDisplayNearestPoint(center).workArea;

  const width = savedPanelBounds?.width ?? PANEL_DEFAULT.width;
  const height = savedPanelBounds?.height ?? PANEL_DEFAULT.height;
  const x = ballRect.x - Math.floor((width - ballRect.width) / 2);
  const y = ballRect.y - Math.floor((height - ballRect.height) / 2);

  shellMode = 'panel';
  mainWindow.setTitle('AI Dropzone');
  ensureWindowTransparent();
  mainWindow.setMaximumSize(10000, 10000);
  mainWindow.setMinimumSize(PANEL_MIN.width, PANEL_MIN.height);
  mainWindow.setResizable(true);
  mainWindow.setBounds(
    clampBoundsToWorkArea({ x, y, width, height }, wa),
  );
  mainWindow.setHasShadow(true);
  setWindowBackgroundMaterial('panel');
  mainWindow.setAlwaysOnTop(false);
  notifyShellMode('panel');
}

function createWindow(): void {
  const startPanel = process.env.DROPZONE_START_PANEL === '1';
  shellMode = startPanel ? 'panel' : 'ball';

  mainWindow = new BrowserWindow({
    width: startPanel ? PANEL_DEFAULT.width : BALL_SIZE,
    height: startPanel ? PANEL_DEFAULT.height : BALL_SIZE,
    minWidth: startPanel ? PANEL_MIN.width : BALL_SIZE,
    minHeight: startPanel ? PANEL_MIN.height : BALL_SIZE,
    maxWidth: startPanel ? undefined : BALL_CAPSULE.width,
    maxHeight: startPanel ? undefined : BALL_CAPSULE.height,
    resizable: startPanel,
    frame: false,
    alwaysOnTop: !startPanel,
    /** 透明 + Win11 圆角：底色只由网页在圆角矩形内绘制，禁止原生方形铺色 */
    transparent: true,
    backgroundColor: '#00000000',
    backgroundMaterial: process.platform === 'win32' ? (startPanel ? 'mica' : 'none') : undefined,
    roundedCorners: true,
    hasShadow: startPanel,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.setTitle('');

  if (isDev) {
    void mainWindow.loadURL(VITE_DEV_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    ensureWindowTransparent();
    if (!startPanel) {
      initBallDock();
      mainWindow?.setTitle('');
      mainWindow?.setHasShadow(false);
    }
    notifyShellMode(shellMode);
  });

  mainWindow.on('blur', () => {
    refreshBallWindowChrome();
    notifyWindowFocused(false);
  });
  mainWindow.on('focus', () => {
    refreshBallWindowChrome();
    notifyWindowFocused(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle(
  'dropzone:getFileMetadata',
  async (
    _event: IpcMainInvokeEvent,
    payload: string | { path: string; hint?: Partial<FileMetadataPayload> },
  ) => {
    const filePath = typeof payload === 'string' ? payload : payload.path;
    const hint = typeof payload === 'string' ? undefined : payload.hint;
    return buildFileMetadata(filePath, hint);
  },
);

ipcMain.handle('dropzone:getFileMetadataBatch', async (_event: IpcMainInvokeEvent, paths: string[]) => {
  const results: FileMetadataPayload[] = [];
  for (const filePath of paths) {
    try {
      results.push(await buildFileMetadata(filePath));
    } catch {
      // skip
    }
  }
  if (results.length === 0) {
    throw new Error('无法读取拖入的文件，请改用手动选择或检查文件权限。');
  }
  return results;
});

async function resolveExistingFilePath(filePath: string): Promise<string> {
  const resolved = normalizeFilePath(filePath);
  if (!resolved) {
    throw new Error('文件路径为空');
  }
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('路径指向的不是文件');
  }
  return resolved;
}

ipcMain.handle('dropzone:openPath', async (_event: IpcMainInvokeEvent, filePath: string) => {
  const resolved = await resolveExistingFilePath(filePath);
  return shell.openPath(resolved);
});

ipcMain.handle('dropzone:showItemInFolder', async (_event: IpcMainInvokeEvent, filePath: string) => {
  const resolved = await resolveExistingFilePath(filePath);
  shell.showItemInFolder(resolved);
});

ipcMain.handle('dropzone:copyFilesToClipboard', async (_event: IpcMainInvokeEvent, paths: string[]) => {
  const resolved = await Promise.all(paths.map(resolveExistingFilePath));
  await copyFilesToClipboard(resolved);
});

ipcMain.handle('dropzone:cutFilesToClipboard', async (_event: IpcMainInvokeEvent, paths: string[]) => {
  const resolved = await Promise.all(paths.map(resolveExistingFilePath));
  await cutFilesToClipboard(resolved);
});

ipcMain.handle('window:getShellMode', () => shellMode);

ipcMain.on('window:getShellModeSync', event => {
  event.returnValue = shellMode;
});

ipcMain.on('window:collapseToBall', () => {
  applyBallMode();
});

ipcMain.on('window:expandToPanel', () => {
  applyPanelMode();
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.on('ball:expandDock', () => {
  if (shellMode !== 'ball' || ballFloating) return;
  ballDockExpanded = true;
  applyBallBounds();
});

ipcMain.on('ball:collapseDock', () => {
  if (shellMode !== 'ball' || ballFloating) return;
  ballDockExpanded = false;
  applyBallBounds();
});

ipcMain.on('ball:finishDrag', () => {
  if (shellMode !== 'ball') return;
  maybeDockBallAfterDrag();
});

ipcMain.on('ball:dragBy', (_event, deltaX: number, deltaY: number) => {
  if (shellMode !== 'ball' || !mainWindow) return;
  const b = mainWindow.getBounds();
  ballAnchor =
    ballEdge === 'left' || ballEdge === 'right'
      ? b.y + deltaY
      : b.x + deltaX;
  if (!ballDockExpanded) ballDockExpanded = true;
  applyBallBounds();
});

/** 悬浮球：相对当前窗口位置自由平移（不贴边吸附） */
ipcMain.on('ball:moveBy', (_event, dx: number, dy: number) => {
  if (shellMode !== 'ball' || !mainWindow) return;
  const b = mainWindow.getBounds();
  const center = {
    x: b.x + Math.floor(b.width / 2),
    y: b.y + Math.floor(b.height / 2),
  };
  const wa = screen.getDisplayNearestPoint(center).workArea;
  let nx = b.x + Math.round(dx);
  let ny = b.y + Math.round(dy);
  const { width, height } = ballDimensions();
  nx = Math.min(wa.x + wa.width - width, Math.max(wa.x, nx));
  ny = Math.min(wa.y + wa.height - height, Math.max(wa.y, ny));
  /** 每次移动固定宽高，避免 Win32 在拖动时把无边框窗口当成可缩放区域导致「整块变大」 */
  mainWindow.setBounds({ x: nx, y: ny, width, height });
});

/** 将悬浮球窗口左上角放到屏幕坐标 (left, top)，与指针抓取偏移配合实现 1:1 跟手 */
ipcMain.on('ball:moveTo', (_event, left: number, top: number) => {
  if (shellMode !== 'ball' || !mainWindow) return;
  ballFloating = true;
  let nx = Math.round(left);
  let ny = Math.round(top);
  const { width, height } = ballDimensions();
  const center = {
    x: nx + Math.floor(width / 2),
    y: ny + Math.floor(height / 2),
  };
  const wa = screen.getDisplayNearestPoint(center).workArea;
  nx = Math.min(wa.x + wa.width - width, Math.max(wa.x, nx));
  ny = Math.min(wa.y + wa.height - height, Math.max(wa.y, ny));
  mainWindow.setBounds({ x: nx, y: ny, width, height });
});

ipcMain.on('ball:setVisualPreset', (_event, preset: BallVisualPreset) => {
  if (shellMode !== 'ball') return;
  if (preset !== 'idle' && preset !== 'capsule') return;
  applyBallVisualPreset(preset);
});

ipcMain.on('ball:getBoundsSync', event => {
  if (!mainWindow) {
    event.returnValue = null;
    return;
  }
  const b = mainWindow.getBounds();
  event.returnValue = { x: b.x, y: b.y, width: b.width, height: b.height };
});
