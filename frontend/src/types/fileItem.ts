import type { FileCategory, FileMetadata } from '../api/types';

export type FileStatus = 'parsing' | 'processed' | 'error';

export interface FileItem {
  id: string;
  /** 同一次会话内去重：文件名 + 大小 + 最后修改时间 */
  dropKey: string;
  /** 磁盘绝对路径（Electron）；Mock 时可为空 */
  sourcePath: string;
  name: string;
  suggestedName: string;
  tags: string[];
  categoryReason: string;
  status: FileStatus;
  droppedAt: Date;
  extension: string;
  sensitive: boolean;
  /** 解析刚完成时显示荧光对勾，约 1.5s 后清除 */
  justCompleted?: boolean;
  parseError?: string;
  /** 首次 /parse 成功时的元数据快照，供 /parse/regenerate 使用 */
  parseMetadata?: FileMetadata;
  /** 后端解析返回的文件类别（LLM/Mock 均有） */
  parseCategory?: FileCategory;
  /** 最近一次重新生成时填写的单次说明（用于建议原因展示） */
  lastExtraPrompt?: string;
}
