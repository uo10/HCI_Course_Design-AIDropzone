export type LogOperation = 'rename' | 'export';

export interface ActivityLogEntry {
  id: number;
  operation: LogOperation;
  timestamp: Date;
  originalPath: string;
  newPath?: string;
  label: string;
}
