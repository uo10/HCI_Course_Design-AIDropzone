import { useCallback, useState } from 'react';
import type { RollbackEntryDto } from '../api/types';
import { fetchJournal, isMockMode, undo } from '../services/dropzoneApi';
import type { ActivityLogEntry, LogOperation } from '../types/activityLog';

const MOCK_STORAGE_KEY = 'aidropzone.mock_journal';
let mockNextId = 1;

function loadMockEntries(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityLogEntry[];
    const entries = parsed.map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
    const maxId = entries.reduce((m, e) => Math.max(m, e.id), 0);
    mockNextId = maxId + 1;
    return entries;
  } catch {
    return [];
  }
}

function saveMockEntries(entries: ActivityLogEntry[]) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(entries));
}

function parseBackendTimestamp(raw: string): Date {
  // 后端当前写入的是 UTC 但不带时区（如 2026-05-28T03:20:11.123456），
  // JS 会按本地时间解析，导致中国时区显示慢 8 小时。这里按 UTC 纠正。
  const hasTz = /([zZ]|[+\-]\d{2}:\d{2})$/.test(raw);
  return new Date(hasTz ? raw : `${raw}Z`);
}

function dtoToEntry(dto: RollbackEntryDto): ActivityLogEntry {
  const op = dto.operation as LogOperation;
  const originalBase = dto.original_path.split(/[/\\]/).pop() ?? dto.original_path;
  const newBase = dto.new_path?.split(/[/\\]/).pop();
  const label =
    op === 'rename' && newBase
      ? `${originalBase} → ${newBase}`
      : op === 'export' && dto.new_path
        ? `导出 ${dto.new_path}`
        : originalBase;

  return {
    id: dto.entry_id,
    operation: op,
    timestamp: parseBackendTimestamp(dto.timestamp),
    originalPath: dto.original_path,
    newPath: dto.new_path ?? undefined,
    label,
  };
}

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>(() =>
    isMockMode() ? loadMockEntries() : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isMockMode()) {
      setEntries(loadMockEntries());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const raw = await fetchJournal();
      setEntries(raw.map(dtoToEntry));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const addEntry = useCallback(
    (payload: {
      operation: LogOperation;
      originalPath: string;
      newPath?: string;
      label: string;
    }) => {
      if (isMockMode()) {
        const entry: ActivityLogEntry = {
          id: mockNextId++,
          operation: payload.operation,
          timestamp: new Date(),
          originalPath: payload.originalPath,
          newPath: payload.newPath,
          label: payload.label,
        };
        setEntries(prev => {
          const next = [entry, ...prev];
          saveMockEntries(next);
          return next;
        });
        return entry.id;
      }
      void refresh();
      return -1;
    },
    [refresh],
  );

  const undoEntry = useCallback(
    async (id: number): Promise<{ ok: boolean; message?: string }> => {
      const entry = entries.find(e => e.id === id);
      if (!entry) return { ok: false, message: '记录不存在' };

      if (isMockMode()) {
        setEntries(prev => {
          const next = prev.filter(e => e.id !== id);
          saveMockEntries(next);
          return next;
        });
        return { ok: true };
      }

      try {
        const res = await undo({ entry_ids: [id] });
        await refresh();
        if (res.failed.length > 0) {
          return { ok: false, message: res.failed[0]?.error ?? '撤回失败' };
        }
        if (res.undone.length === 0) {
          return { ok: false, message: '未能撤回该操作' };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : '撤回失败' };
      }
    },
    [entries, refresh],
  );

  return { entries, loading, error, refresh, addEntry, undoEntry };
}
