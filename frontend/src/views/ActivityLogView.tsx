import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Package, Pencil, RotateCcw } from 'lucide-react';
import type { ActivityLogEntry } from '../types/activityLog';
import { formatRelativeTime } from '../utils/formatTime';

interface Props {
  entries: ActivityLogEntry[];
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onUndo: (id: number) => Promise<{ ok: boolean; message?: string }>;
}

export function ActivityLogView({
  entries,
  loading,
  error,
  onBack,
  onRefresh,
  onUndo,
}: Props) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  async function handleUndo(id: number) {
    const entry = entries.find(e => e.id === id);
    if (
      entry &&
      !window.confirm(
        entry.operation === 'rename'
          ? `撤回此次改名？\n${entry.label}`
          : `撤回此次导出？\n${entry.label}`,
      )
    ) {
      return;
    }
    const result = await onUndo(id);
    if (!result.ok) {
      window.alert(result.message ?? '撤回失败');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="electron-no-drag flex items-center gap-2 border-b border-white/40 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1.5 text-slate-500 hover:bg-white/50 hover:text-slate-700"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-800">操作日志与回滚</h2>
          <p className="text-[11px] text-slate-500">改名、导出记录；撤回将恢复磁盘状态</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white/50 disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      <div className="electron-no-drag min-h-0 flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        )}

        {error && !loading && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/50 bg-white/30 py-16 text-center">
            <RotateCcw className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">暂无操作记录</p>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              采用建议改名或打包导出后，记录会出现在这里。
            </p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <ul className="flex flex-col gap-2">
            {entries.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-2xl border border-white/55 bg-white/55 p-3 shadow-sm backdrop-blur-sm"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    entry.operation === 'rename'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-violet-50 text-violet-600'
                  }`}
                >
                  {entry.operation === 'rename' ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {entry.operation === 'rename' ? '文件改名' : '标签导出'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-600">{entry.label}</p>
                  {entry.newPath && entry.operation === 'export' && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{entry.newPath}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleUndo(entry.id)}
                  className="shrink-0 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-white hover:text-blue-600"
                >
                  撤回
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
