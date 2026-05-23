import { contextBridge, ipcRenderer, webUtils } from 'electron';

export type ShellMode = 'ball' | 'panel';

contextBridge.exposeInMainWorld('dropzone', {
  isElectron: true,
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getFileMetadata: (filePath: string) =>
    ipcRenderer.invoke('dropzone:getFileMetadata', filePath),
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
  snapBallDock: () => {
    ipcRenderer.send('ball:snapDock');
  },
  dragBallBy: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('ball:dragBy', deltaX, deltaY);
  },
  onShellModeChanged: (callback: (mode: ShellMode) => void) => {
    const handler = (_event: unknown, mode: ShellMode) => callback(mode);
    ipcRenderer.on('shell:modeChanged', handler);
    return () => {
      ipcRenderer.removeListener('shell:modeChanged', handler);
    };
  },
});
