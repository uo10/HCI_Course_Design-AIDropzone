/**
 * 与 backend/API_CONTRACT.md 一致的类型（snake_case）。
 */

export type FileCategory =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'unknown';

export type OperationStatus = 'success' | 'failure';

export type RenameMode = 'skip' | 'overwrite' | 'auto_increment';

/** 卡片上显示的状态（仅 UI，不发给后端） */
export type FileCardStatus = 'received' | 'parsing' | 'complete' | 'failure';

export interface FileMetadata {
  path: string;
  size_bytes: number;
  extension: string;
  mime_type?: string;
  name_before_drop: string;
}

export interface NamingSchema {
  pattern?: string;
  separator?: string;
  case?: 'lower' | 'upper' | 'preserve';
}

export interface ParseRequest {
  file: FileMetadata;
  context_tags?: string[] | null;
  prefer_mock?: boolean;
}

export interface ParseItem {
  file_path: string;
  suggested_name: string;
  category: FileCategory;
  tags: string[];
  summary: string;
  keywords: string[];
  confidence: number;
  parsed_at: string;
}

export interface ParseResult {
  status: OperationStatus;
  data: ParseItem | null;
  error: string | null;
}

export interface RenameItem {
  source_path: string;
  new_name: string;
  tags_applied: string[];
  notes?: string;
}

export interface RenameRequest {
  items: RenameItem[];
  naming?: NamingSchema;
  dry_run?: boolean;
  conflict_mode?: RenameMode;
}

export interface RenamedEntry {
  old: string;
  new: string;
  tags: string[];
}

export interface RenameResult {
  status: OperationStatus;
  dry_run: boolean;
  renamed: RenamedEntry[];
  skipped: Array<{ path: string; reason: string }>;
  errors: Array<{ path: string; error: string }>;
  timestamp: string;
}

export interface ExportRequest {
  tags: string[];
  output_dir: string;
  package_name?: string;
  include_manifest?: boolean;
}

export interface ExportManifestSummary {
  created_at?: string;
  tag_filter: string[];
  total_files: number;
  total_size_bytes: number;
  entries: unknown[];
}

export interface ExportResult {
  status: OperationStatus;
  zip_path?: string;
  manifest?: ExportManifestSummary;
  error?: string | null;
}

export interface UndoRequest {
  count: number;
  filter_operation?: 'rename' | 'export' | 'delete';
}

export interface UndoEntry {
  entry_id: number;
  operation: string;
  timestamp?: string;
  original_path: string;
  new_path: string;
  tags_snapshot?: string[];
  metadata?: Record<string, unknown>;
}

export interface UndoResult {
  status: OperationStatus;
  undone: UndoEntry[];
  failed: Array<{ entry_id: number; error: string }>;
  remaining_log_size: number;
}

export type FileDisplayStatus =
  | 'stashed'
  | 'manual_pending'
  | 'manual_ready'
  | 'parsing'
  | 'parsed'
  | 'renamed'
  | 'failed';

export type CardSortKey = 'name' | 'status' | 'tag';

/** FileCard 展示用 */
export interface FileCardViewModel {
  metadata: FileMetadata;
  status: FileCardStatus;
  source_mode?: 'stash_only' | 'manual' | 'ai_assisted';
  display_status?: FileDisplayStatus;
  is_renamed?: boolean;
  suggested_name?: string;
  category?: FileCategory;
  tags: string[];
  summary?: string;
  confidence?: number;
  error?: string;
}
