import type { FileMetadata } from '../api/types';

export type ShellMode = 'ball' | 'panel';

export interface DropzoneBridge {
  isElectron: boolean;
  getPathForFile(file: File): string;
  getFileMetadata(path: string): Promise<FileMetadata>;
  getFileMetadataBatch(paths: string[]): Promise<FileMetadata[]>;
  getShellMode(): Promise<ShellMode>;
  expandToPanel(): void;
  collapseToBall(): void;
  closeWindow(): void;
  expandBallDock(): void;
  collapseBallDock(): void;
  snapBallDock(): void;
  dragBallBy(deltaX: number, deltaY: number): void;
  onShellModeChanged(callback: (mode: ShellMode) => void): () => void;
}

declare global {
  interface Window {
    dropzone?: DropzoneBridge;
  }
}

export {};
