import { contextBridge, ipcRenderer, webUtils } from 'electron';

export type ShellMode = 'ball' | 'panel';

contextBridge.exposeInMainWorld('dropzone', {
  isElectron: true,
  getPathForFile: (file: File) => {
    try {
      const fromWeb = webUtils.getPathForFile(file);
      if (fromWeb && fromWeb.trim().length > 0) return fromWeb.trim();
    } catch {
      // fall through
    }
    const legacy = file as File & { path?: string };
    if (legacy.path && legacy.path.trim().length > 0) {
      return legacy.path.trim();
    }
    return '';
  },
  getFileMetadata: (filePath: string, hint?: Record<string, unknown>) =>
    ipcRenderer.invoke('dropzone:getFileMetadata', { path: filePath, hint }),
  getFileMetadataBatch: (paths: string[]) =>
    ipcRenderer.invoke('dropzone:getFileMetadataBatch', paths),
  getShellMode: () => ipcRenderer.invoke('window:getShellMode') as Promise<ShellMode>,
  expandToPanel: () => {
    ipcRenderer.send('window:expandToPanel');
  },
  collapseToBall: () => {
    ipcRenderer.send('window:collapseToBall');
  },
  closeWindow: () => {
    ipcRenderer.send('window:close');
  },
  expandBallDock: () => {
    ipcRenderer.send('ball:expandDock');
  },
  collapseBallDock: () => {
    ipcRenderer.send('ball:collapseDock');
  },
  finishBallDrag: () => {
    ipcRenderer.send('ball:finishDrag');
  },
  dragBallBy: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('ball:dragBy', deltaX, deltaY);
  },
  moveBallBy: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('ball:moveBy', deltaX, deltaY);
  },
  moveBallTo: (left: number, top: number) => {
    ipcRenderer.send('ball:moveTo', left, top);
  },
  getBallBoundsSync: () =>
    ipcRenderer.sendSync('ball:getBoundsSync') as {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
  onShellModeChanged: (callback: (mode: ShellMode) => void) => {
    const handler = (_event: unknown, mode: ShellMode) => callback(mode);
    ipcRenderer.on('shell:modeChanged', handler);
    return () => {
      ipcRenderer.removeListener('shell:modeChanged', handler);
    };
  },
});
