import type { FileMetadata } from '../api/types';

export type ShellMode = 'ball' | 'panel';
export type BallVisualPreset = 'idle' | 'capsule';

export interface BallBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropzoneBridge {
  isElectron: boolean;
  getPathForFile(file: File): string;
  getFileMetadata(path: string, hint?: Record<string, unknown>): Promise<FileMetadata>;
  getFileMetadataBatch(paths: string[]): Promise<FileMetadata[]>;
  /** 用系统默认应用打开文件；成功返回空字符串，失败返回错误信息 */
  openPath(filePath: string): Promise<string>;
  showItemInFolder(filePath: string): Promise<void>;
  copyFilesToClipboard(paths: string[]): Promise<void>;
  cutFilesToClipboard(paths: string[]): Promise<void>;
  getShellMode(): Promise<ShellMode>;
  getShellModeSync(): ShellMode;
  expandToPanel(): void;
  collapseToBall(): void;
  closeWindow(): void;
  expandBallDock(): void;
  collapseBallDock(): void;
  /** 拖动结束：靠近边缘则贴边缩入，否则保持当前位置 */
  finishBallDrag(): void;
  dragBallBy(deltaX: number, deltaY: number): void;
  /** 悬浮球：按屏幕像素增量自由移动窗口（相对当前位置） */
  moveBallBy(deltaX: number, deltaY: number): void;
  /** 悬浮球：将窗口左上角放到屏幕坐标（与抓取偏移配合，实现与指针 1:1 跟手） */
  moveBallTo(left: number, top: number): void;
  /** 主进程同步读悬浮球窗口外接矩形（仅用于按下时算抓取偏移） */
  getBallBoundsSync(): BallBounds | null;
  setBallVisualPreset(preset: BallVisualPreset): void;
  onShellModeChanged(callback: (mode: ShellMode) => void): () => void;
  onWindowFocused(callback: (focused: boolean) => void): () => void;
}

declare global {
  interface Window {
    dropzone?: DropzoneBridge;
  }
}

export {};
