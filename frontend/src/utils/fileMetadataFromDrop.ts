import type { FileMetadata } from '../api/types';

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : 'unknown';
}

/** 用拖入时的 File 对象构建元数据（后端 /parse 不读盘，无需 IPC stat） */
export function metadataFromDroppedFile(file: File, filePath: string): FileMetadata {
  const path = filePath.trim();
  return {
    path,
    size_bytes: file.size,
    extension: extensionOf(file.name),
    mime_type: file.type || 'application/octet-stream',
    name_before_drop: file.name,
  };
}
