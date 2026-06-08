import type {
  ExportRequest,
  ExportResult,
  FileMetadata,
  ParseResult,
  RegenerateRequest,
  RenameRequest,
  RenameResult,
  RollbackEntryDto,
  JournalDeleteResult,
  TagSearchRequest,
  TagSearchResult,
  TagsLibraryResult,
  UndoRequest,
  UndoResult,
} from './types';

function apiBase(): string {
  return (
    localStorage.getItem('aidropzone.api_base')?.trim() ||
    import.meta.env.VITE_API_BASE?.trim() ||
    'http://127.0.0.1:8000'
  );
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new TypeError('Failed to fetch');
    }
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function get<T>(path: string): Promise<T> {
  return request<T>(`${apiBase()}${path}`);
}

export function parseFile(file: FileMetadata, preferMock = false): Promise<ParseResult> {
  return post<ParseResult>('/parse', { file, prefer_mock: preferMock });
}

export function regenerateParse(req: RegenerateRequest): Promise<ParseResult> {
  return post<ParseResult>('/parse/regenerate', {
    file: req.file,
    extra_prompt: req.extra_prompt ?? '',
    context_tags: req.context_tags,
    prefer_mock: req.prefer_mock ?? false,
  });
}

export function renameFiles(req: RenameRequest): Promise<RenameResult> {
  return post<RenameResult>('/rename', req);
}

export function undoOperation(req: UndoRequest): Promise<UndoResult> {
  const body: Record<string, unknown> = {
    filter_operation: req.filter_operation,
  };
  if (req.entry_ids?.length) {
    body.entry_ids = req.entry_ids;
  } else {
    body.count = req.count ?? 1;
  }
  return post<UndoResult>('/undo', body);
}

export function undoLast(filterOperation?: UndoRequest['filter_operation']): Promise<UndoResult> {
  return undoOperation({ count: 1, filter_operation: filterOperation });
}

export function getJournal(): Promise<RollbackEntryDto[]> {
  return get<RollbackEntryDto[]>('/journal');
}

/** 仅从 journal 移除记录，不撤回磁盘上的改名/导出 */
export function deleteJournalEntries(entryIds: number[]): Promise<JournalDeleteResult> {
  return request<JournalDeleteResult>(`${apiBase()}/journal`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: entryIds }),
  });
}

export function exportPackages(req: ExportRequest): Promise<ExportResult> {
  return post<ExportResult>('/export', req);
}

export function getTagsLibrary(): Promise<TagsLibraryResult> {
  return get<TagsLibraryResult>('/tags');
}

export function searchByTags(req: TagSearchRequest): Promise<TagSearchResult> {
  return post<TagSearchResult>('/tags/search', {
    tags: req.tags,
    match_mode: req.match_mode ?? 'any',
  });
}

export interface BackendConfigPayload {
  workspace_root?: string;
  naming_style_prompt?: string;
  ai_parser?: 'mock' | 'llm';
  ai_parser_options?: {
    llm?: {
      provider?: string;
      model?: string;
      base_url?: string;
      api_key_env?: string;
      api_key?: string;
      api_key_set?: boolean;
    };
  };
}

export interface ConfigUpdatePayload {
  ai_parser?: 'mock' | 'llm';
  workspace_root?: string;
  naming_style_prompt?: string;
  llm_provider?: string;
  llm_model?: string;
  llm_base_url?: string;
  llm_api_key?: string;
}

export function getBackendConfig(): Promise<{ config: BackendConfigPayload }> {
  return get<{ config: BackendConfigPayload }>('/config');
}

export function putBackendConfig(body: ConfigUpdatePayload): Promise<{ config: BackendConfigPayload }> {
  return request<{ config: BackendConfigPayload }>(`${apiBase()}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
