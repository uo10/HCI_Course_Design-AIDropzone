import {
  exportPackages,
  getJournal,
  parseFile,
  renameFiles,
  undoOperation,
} from '../api/client';
import type {
  ExportRequest,
  ExportResult,
  FileMetadata,
  ParseResult,
  RenameRequest,
  RenameResult,
  RollbackEntryDto,
  UndoRequest,
  UndoResult,
} from '../api/types';

const MOCK_OVERRIDE_KEY = 'aidropzone.use_mock';

/** 默认 Mock；仅当 .env 或设置里显式设为 false 时走真后端 */
export function isMockMode(): boolean {
  const override = localStorage.getItem(MOCK_OVERRIDE_KEY);
  if (override === 'true') return true;
  if (override === 'false') return false;
  return import.meta.env.VITE_USE_MOCK !== 'false';
}

/** @deprecated 请使用 isMockMode() */
export const useMockApi = isMockMode();

export function setMockModeOverride(mock: boolean) {
  localStorage.setItem(MOCK_OVERRIDE_KEY, mock ? 'true' : 'false');
}

export function getApiBase(): string {
  return (
    localStorage.getItem('aidropzone.api_base')?.trim() ||
    import.meta.env.VITE_API_BASE?.trim() ||
    'http://127.0.0.1:8000'
  );
}

export function parseOne(file: FileMetadata, preferMock = isMockMode()): Promise<ParseResult> {
  return parseFile(file, preferMock);
}

export function rename(req: RenameRequest): Promise<RenameResult> {
  return renameFiles(req);
}

export function undo(req: UndoRequest): Promise<UndoResult> {
  return undoOperation(req);
}

export function fetchJournal(): Promise<RollbackEntryDto[]> {
  return getJournal();
}

export function exportZip(req: ExportRequest): Promise<ExportResult> {
  return exportPackages(req);
}
