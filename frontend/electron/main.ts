import { app, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const VITE_DEV_URL = 'http://127.0.0.1:5173';
const isDev = !app.isPackaged;

/** 360 式悬浮球：窗口与球同大，贴边时仅露出一条 */
const BALL_SIZE = 52;
const BALL_PEEK = 14;
const PANEL_DEFAULT = { width: 380, height: 560 };
const PANEL_MIN = { width: 320, height: 400 };
const THEME_BG = '#0f1419';

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

async function buildFileMetadata(filePath: string): Promise<FileMetadataPayload> {
  const stat = await fs.stat(filePath);
  const name_before_drop = path.basename(filePath);
  const extension = path.extname(filePath).slice(1).toLowerCase() || 'unknown';

  return {
    path: filePath,
    size_bytes: stat.size,
    extension,
    mime_type: 'application/octet-stream',
    name_before_drop,
  };
}

function notifyShellMode(mode: ShellMode): void {
  mainWindow?.webContents.send('shell:modeChanged', mode);
}

function setBallTransparency(ball: boolean): void {
  if (!mainWindow) return;
  mainWindow.setBackgroundColor(ball ? '#00000000' : THEME_BG);
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
  if (ballEdge === 'left' || ballEdge === 'right') {
    const min = wa.y;
    const max = wa.y + wa.height - BALL_SIZE;
    return Math.min(max, Math.max(min, ballAnchor));
  }
  const min = wa.x;
  const max = wa.x + wa.width - BALL_SIZE;
  return Math.min(max, Math.max(min, ballAnchor));
}

function ballBoundsPeek(wa: Electron.Rectangle): Electron.Rectangle {
  const anchor = clampBallAnchor(wa);
  switch (ballEdge) {
    case 'right':
      return {
        x: wa.x + wa.width - BALL_PEEK,
        y: anchor,
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
    case 'left':
      return {
        x: wa.x - (BALL_SIZE - BALL_PEEK),
        y: anchor,
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
    case 'top':
      return {
        x: anchor,
        y: wa.y - (BALL_SIZE - BALL_PEEK),
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
    case 'bottom':
      return {
        x: anchor,
        y: wa.y + wa.height - BALL_PEEK,
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
  }
}

function ballBoundsExpanded(wa: Electron.Rectangle): Electron.Rectangle {
  const anchor = clampBallAnchor(wa);
  switch (ballEdge) {
    case 'right':
      return {
        x: wa.x + wa.width - BALL_SIZE,
        y: anchor,
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
    case 'left':
      return { x: wa.x, y: anchor, width: BALL_SIZE, height: BALL_SIZE };
    case 'top':
      return { x: anchor, y: wa.y, width: BALL_SIZE, height: BALL_SIZE };
    case 'bottom':
      return {
        x: anchor,
        y: wa.y + wa.height - BALL_SIZE,
        width: BALL_SIZE,
        height: BALL_SIZE,
      };
  }
}

function applyBallBounds(): void {
  if (!mainWindow || shellMode !== 'ball') return;
  const wa = workAreaForBall();
  const target = ballDockExpanded
    ? ballBoundsExpanded(wa)
    : ballBoundsPeek(wa);
  mainWindow.setBounds(target);
}

function snapBallToNearestEdge(): void {
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  const wa = screen.getDisplayNearestPoint(b).workArea;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  const distLeft = cx - wa.x;
  const distRight = wa.x + wa.width - cx;
  const distTop = cy - wa.y;
  const distBottom = wa.y + wa.height - cy;
  const min = Math.min(distLeft, distRight, distTop, distBottom);

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

  ballDockExpanded = false;
  applyBallBounds();
}

function initBallDock(): void {
  const wa = screen.getPrimaryDisplay().workArea;
  ballEdge = 'right';
  ballAnchor =
    wa.y + Math.floor((wa.height - BALL_SIZE) / 2);
  ballDockExpanded = false;
  applyBallBounds();
}

function applyBallMode(): void {
  if (!mainWindow) return;

  if (shellMode === 'panel') {
    savedPanelBounds = mainWindow.getBounds();
    const b = mainWindow.getBounds();
    ballAnchor = b.y + Math.floor((b.height - BALL_SIZE) / 2);
    ballEdge = 'right';
  }

  shellMode = 'ball';
  setBallTransparency(true);
  mainWindow.setResizable(false);
  mainWindow.setMinimumSize(BALL_SIZE, BALL_SIZE);
  mainWindow.setMaximumSize(BALL_SIZE, BALL_SIZE);
  ballDockExpanded = false;
  snapBallToNearestEdge();
  notifyShellMode('ball');
}

function applyPanelMode(): void {
  if (!mainWindow) return;

  const wa = workAreaForBall();
  const ballRect =
    ballDockExpanded
      ? ballBoundsExpanded(wa)
      : ballBoundsPeek(wa);

  const width = savedPanelBounds?.width ?? PANEL_DEFAULT.width;
  const height = savedPanelBounds?.height ?? PANEL_DEFAULT.height;
  const x = ballRect.x - Math.floor((width - ballRect.width) / 2);
  const y = ballRect.y - Math.floor((height - ballRect.height) / 2);

  shellMode = 'panel';
  setBallTransparency(false);
  mainWindow.setMaximumSize(10000, 10000);
  mainWindow.setMinimumSize(PANEL_MIN.width, PANEL_MIN.height);
  mainWindow.setResizable(true);
  mainWindow.setBounds(
    clampBoundsToWorkArea({ x, y, width, height }, wa),
  );
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
    maxWidth: startPanel ? undefined : BALL_SIZE,
    maxHeight: startPanel ? undefined : BALL_SIZE,
    resizable: startPanel,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: startPanel ? THEME_BG : '#00000000',
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    void mainWindow.loadURL(VITE_DEV_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (!startPanel) {
      initBallDock();
      setBallTransparency(true);
    }
    notifyShellMode(shellMode);
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

ipcMain.handle('dropzone:getFileMetadata', async (_event: IpcMainInvokeEvent, filePath: string) => {
  try {
    return await buildFileMetadata(filePath);
  } catch {
    throw new Error('无法读取文件信息，请检查文件是否存在或是否有权限。');
  }
});

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

ipcMain.handle('window:getShellMode', () => shellMode);

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
  if (shellMode !== 'ball') return;
  ballDockExpanded = true;
  applyBallBounds();
});

ipcMain.on('ball:collapseDock', () => {
  if (shellMode !== 'ball') return;
  ballDockExpanded = false;
  applyBallBounds();
});

ipcMain.on('ball:snapDock', () => {
  if (shellMode !== 'ball') return;
  snapBallToNearestEdge();
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
