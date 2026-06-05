// 与 backend API_CONTRACT 对齐，全部 snake_case

export type FileCategory =
  | 'document' | 'image' | 'video' | 'audio' | 'archive'
  | 'code' | 'spreadsheet' | 'presentation' | 'pdf' | 'unknown';

export type OperationStatus = 'success' | 'failure';

export type LogOperation = 'rename' | 'export' | 'delete';

export interface FileMetadata {
  path: string;
  size_bytes: number;
  extension: string;
  mime_type?: string;
  name_before_drop: string;
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

export interface RegenerateRequest {
  file: FileMetadata;
  extra_prompt?: string;
  context_tags?: string[];
  prefer_mock?: boolean;
}

export interface RenameItem {
  source_path: string;
  new_name: string;
  tags_applied: string[];
  notes?: string;
}

export interface RenameRequest {
  items: RenameItem[];
  naming?: { pattern?: string; separator?: string; case?: string };
  dry_run?: boolean;
  conflict_mode?: 'skip' | 'overwrite' | 'auto_increment';
}

export interface RenameResult {
  status: OperationStatus;
  dry_run: boolean;
  renamed: { old: string; new: string; tags: string[] }[];
  skipped: { path: string; reason: string }[];
  errors: { path: string; error: string }[];
  timestamp: string;
}

export interface RollbackEntryDto {
  entry_id: number;
  operation: LogOperation;
  timestamp: string;
  original_path: string;
  new_path?: string | null;
  tags_snapshot: string[];
  metadata: Record<string, unknown>;
}

export interface UndoRequest {
  count?: number;
  filter_operation?: LogOperation;
  entry_ids?: number[];
}

export interface UndoResult {
  status: OperationStatus;
  undone: RollbackEntryDto[];
  failed: { entry_id?: number; error: string }[];
  remaining_log_size: number;
}

export interface ManifestEntry {
  original_path: string;
  name_in_package: string;
  size_bytes: number;
  tags: string[];
  checksum_sha256: string;
}

export interface ExportManifest {
  created_at: string;
  tag_filter: string[];
  total_files: number;
  total_size_bytes: number;
  entries: ManifestEntry[];
}

export interface ExportRequest {
  tags: string[];
  output_dir: string;
  package_name?: string;
  include_manifest?: boolean;
}

export interface ExportResult {
  status: OperationStatus;
  zip_path?: string | null;
  manifest?: ExportManifest | null;
  errors: { path?: string; error: string }[];
}
