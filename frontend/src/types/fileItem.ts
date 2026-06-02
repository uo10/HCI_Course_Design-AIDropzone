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
}
