import type { ApiClient } from './client';
import type {
  ExportRequest,
  ExportResult,
  ParseRequest,
  ParseResult,
  RenameRequest,
  RenameResult,
  UndoRequest,
  UndoResult,
} from './types';

async function postJson<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const errBody = (await response.json()) as { error?: string; detail?: string };
      message = errBody.error ?? errBody.detail ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export class HttpApiClient implements ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  parse(req: ParseRequest): Promise<ParseResult> {
    return postJson<ParseResult>(this.baseUrl, '/parse', req);
  }

  rename(req: RenameRequest): Promise<RenameResult> {
    return postJson<RenameResult>(this.baseUrl, '/rename', req);
  }

  export(req: ExportRequest): Promise<ExportResult> {
    return postJson<ExportResult>(this.baseUrl, '/export', req);
  }

  undo(req: UndoRequest): Promise<UndoResult> {
    return postJson<UndoResult>(this.baseUrl, '/undo', req);
  }
}
