import { resolveDroppedFilePath } from './electronPath';

/** 在 drop 事件的同步调用栈内，从 DataTransfer 取出 File 并解析磁盘路径 */
export function filesFromDataTransferSync(dt: DataTransfer): File[] {
  const out: File[] = [];
  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files.item(i);
      if (f) out.push(f);
    }
  }
  if (out.length === 0 && dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/** 同步解析路径并写入 WeakMap（须在 drop 同步栈内调用） */
export function resolvePathsForDroppedFiles(files: File[]): { file: File; sourcePath: string }[] {
  return files.map(file => ({
    file,
    sourcePath: resolveDroppedFilePath(file),
  }));
}
