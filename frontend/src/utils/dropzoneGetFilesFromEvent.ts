import { fromEvent } from 'file-selector';
import type { DropEvent } from 'react-dropzone';
import { filesFromDataTransferSync, resolvePathsForDroppedFiles } from './nativeDropFiles';

/**
 * react-dropzone 默认的 `file-selector/fromEvent` 在存在 `dataTransfer.items` 时会对每个条目
 * `await Promise.all(...)`，拖放同步阶段结束后才得到 File；此时 Electron 的
 * `webUtils.getPathForFile` 已无法工作（路径恒空）。
 *
 * Electron 下对 **drop** 在同步栈内用 `dataTransfer.files`（或 items.getAsFile）取 File 并解析路径。
 */
export function dropzoneGetFilesFromEvent(
  evt: DropEvent,
): Promise<Array<File | DataTransferItem>> {
  if (
    window.dropzone?.isElectron &&
    evt &&
    typeof evt === 'object' &&
    'type' in evt &&
    evt.type === 'drop' &&
    'dataTransfer' in evt &&
    evt.dataTransfer
  ) {
    const files = filesFromDataTransferSync(evt.dataTransfer);
    if (files.length > 0) {
      resolvePathsForDroppedFiles(files);
      return Promise.resolve(files);
    }
  }
  return fromEvent(evt as Parameters<typeof fromEvent>[0]) as Promise<Array<File | DataTransferItem>>;
}