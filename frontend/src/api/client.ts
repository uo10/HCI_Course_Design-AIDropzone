import { HttpApiClient } from './HttpApiClient';
import { MockApiClient } from './MockApiClient';
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

export interface ApiClient {
  parse(req: ParseRequest): Promise<ParseResult>;
  rename(req: RenameRequest): Promise<RenameResult>;
  export(req: ExportRequest): Promise<ExportResult>;
  undo(req: UndoRequest): Promise<UndoResult>;
}

let clientInstance: ApiClient | null = null;

function shouldUseMockClient(): boolean {
  if (import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.VITE_USE_MOCK === '1') {
    return true;
  }
  if (import.meta.env.VITE_USE_MOCK === 'false' || import.meta.env.VITE_USE_MOCK === '0') {
    return false;
  }
  const base = import.meta.env.VITE_API_BASE?.trim();
  return !base;
}

function createClient(): ApiClient {
  if (shouldUseMockClient()) {
    return new MockApiClient();
  }
  const base =
    import.meta.env.VITE_API_BASE?.trim() || 'http://127.0.0.1:8000';
  return new HttpApiClient(base);
}

export type ApiMode = 'mock' | 'http';

export function getApiConfig(): { mode: ApiMode; baseUrl: string } {
  const mock = shouldUseMockClient();
  return {
    mode: mock ? 'mock' : 'http',
    baseUrl: mock
      ? ''
      : import.meta.env.VITE_API_BASE?.trim() || 'http://127.0.0.1:8000',
  };
}

export function getClient(): ApiClient {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}

/** 测试或切换环境时重置单例 */
export function resetClient(): void {
  clientInstance = null;
}
