import { contextBridge, ipcRenderer, webUtils } from 'electron';

export type ShellMode = 'ball' | 'panel';
export type BallVisualPreset = 'idle' | 'capsule';

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
  openPath: (filePath: string) =>
    ipcRenderer.invoke('dropzone:openPath', filePath) as Promise<string>,
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke('dropzone:showItemInFolder', filePath) as Promise<void>,
  copyFilesToClipboard: (paths: string[]) =>
    ipcRenderer.invoke('dropzone:copyFilesToClipboard', paths) as Promise<void>,
  cutFilesToClipboard: (paths: string[]) =>
    ipcRenderer.invoke('dropzone:cutFilesToClipboard', paths) as Promise<void>,
  getShellMode: () => ipcRenderer.invoke('window:getShellMode') as Promise<ShellMode>,
  getShellModeSync: () => ipcRenderer.sendSync('window:getShellModeSync') as ShellMode,
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
  setBallVisualPreset: (preset: BallVisualPreset) => {
    ipcRenderer.send('ball:setVisualPreset', preset);
  },
  onShellModeChanged: (callback: (mode: ShellMode) => void) => {
    const handler = (_event: unknown, mode: ShellMode) => callback(mode);
    ipcRenderer.on('shell:modeChanged', handler);
    return () => {
      ipcRenderer.removeListener('shell:modeChanged', handler);
    };
  },
  onWindowFocused: (callback: (focused: boolean) => void) => {
    const handler = (_event: unknown, focused: boolean) => callback(focused);
    ipcRenderer.on('shell:windowFocused', handler);
    return () => {
      ipcRenderer.removeListener('shell:windowFocused', handler);
    };
  },
});
