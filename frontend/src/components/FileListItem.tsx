import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { FileItem } from '../types/fileItem';
import { formatRelativeTime } from '../utils/formatTime';
import { TagChip } from './TagChip';
import { FileIconActions } from './FileIconActions';

interface Props {
  file: FileItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function FileListItem({ file, selected, onSelect, onRemove }: Props) {
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 3200);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  const statusVariant =
    file.status === 'processed'
      ? 'status-processed'
      : file.status === 'parsing'
        ? 'status-stashed'
        : 'status-stashed';
  const statusLabel =
    file.status === 'processed'
      ? '已处理'
      : file.status === 'parsing'
        ? '解析中'
        : '报错';

  function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    if (
      window.confirm(
        `从列表中移除「${file.name}」？\n不会删除磁盘上的原文件，仅从本次整理会话中移除。`,
      )
    ) {
      onRemove();
    }
  }

  return (
    <motion.li
      layout
      layoutId={`file-${file.id}`}
      initial={{ opacity: 0, scale: 0.88, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ type: 'spring', stiffness: 480, damping: 26 }}
      onClick={onSelect}
      className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors duration-150 ${
        selected
          ? 'border-blue-400/90 bg-blue-50/85 ring-2 ring-blue-200/50 backdrop-blur-sm'
          : 'border-white/55 bg-white/55 shadow-sm backdrop-blur-sm hover:bg-white/75'
      } ${file.justCompleted ? 'ring-2 ring-emerald-300/60' : ''}`}
    >
      <FileIconActions
        sourcePath={file.sourcePath}
        extension={file.extension}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/80 text-blue-600 shadow-sm"
        onActionError={setActionError}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <TagChip
            label={statusLabel}
            variant={file.status === 'error' ? 'sensitive' : statusVariant}
          />
          {file.tags
            .filter(t => t !== 'sensitive')
            .slice(0, 2)
            .map(t => (
              <TagChip key={t} label={t} />
            ))}
        </div>
        <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
        {actionError && (
          <p className="mt-0.5 truncate text-[10px] text-amber-600">{actionError}</p>
        )}
        {file.status === 'error' && file.parseError && (
          <p className="mt-0.5 truncate text-[10px] text-red-500">{file.parseError}</p>
        )}
      </div>

      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <AnimatePresence mode="wait">
          {file.justCompleted ? (
            <motion.div
              key="check"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{
                scale: [0.2, 1.25, 1],
                opacity: 1,
              }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="relative flex h-9 w-9 items-center justify-center"
            >
              <span
                className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"
                aria-hidden
              />
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 shadow-[0_0_16px_5px_rgba(52,211,153,0.65)]">
                <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
              </span>
            </motion.div>
          ) : (
            <motion.span
              key="time"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-slate-400"
            >
              {formatRelativeTime(file.droppedAt)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleRemove}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-50 hover:bg-red-50 hover:text-red-500 hover:opacity-100"
        aria-label={`从列表移除 ${file.name}`}
        title="从列表移除"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.li>
  );
}
