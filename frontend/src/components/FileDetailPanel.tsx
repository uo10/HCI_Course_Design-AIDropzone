import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ChevronDown,
  Lightbulb,
  Check,
  Ban,
  Shield,
  Lock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { FileItem } from '../types/fileItem';
import { isMockMode } from '../services/dropzoneApi';
import { FileIcon } from '../utils/fileIcon';
import { normalizeUserTag, normalizeUserTagMessage } from '../utils/normalizeUserTag';
import { CategoryReasonBlock } from './CategoryReasonBlock';
import { TagChip } from './TagChip';

interface Props {
  file: FileItem;
  onClose: () => void;
  onAdoptRename?: (file: FileItem, newName: string, tags: string[]) => Promise<void>;
  onRegenerate?: (extraPrompt: string, contextTags: string[]) => Promise<void>;
}

export function FileDetailPanel({ file, onClose, onAdoptRename, onRegenerate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editedName, setEditedName] = useState(file.suggestedName);
  const [editedTags, setEditedTags] = useState<string[]>([...file.tags]);
  const [tagInput, setTagInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const canRegenerate =
    !isMockMode() &&
    Boolean(file.sourcePath) &&
    file.status === 'processed' &&
    Boolean(file.parseMetadata) &&
    Boolean(onRegenerate);

  useEffect(() => {
    setEditedName(file.suggestedName);
  }, [file.id, file.suggestedName]);

  useEffect(() => {
    setEditedTags([...file.tags]);
  }, [file.id, file.tags]);

  useEffect(() => {
    setAdopting(false);
    setRegenOpen(false);
    setExtraPrompt('');
    setRegenerating(false);
  }, [file.id]);

  function addTag() {
    const result = normalizeUserTag(tagInput);
    if (!result.ok) {
      if (tagInput.trim()) {
        showToast(normalizeUserTagMessage(result.reason));
      }
      setTagInput('');
      return;
    }
    if (!editedTags.includes(result.tag)) {
      setEditedTags(prev => [...prev, result.tag]);
    }
    setTagInput('');
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleRegenerateSubmit() {
    if (!onRegenerate) {
      showToast('重新生成未初始化，请刷新应用重试');
      return;
    }
    setRegenerating(true);
    showToast('正在重新生成…');
    try {
      await onRegenerate(extraPrompt, editedTags);
      setRegenOpen(false);
      setExtraPrompt('');
      showToast('已更新命名建议');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重新生成失败');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAdopt() {
    // 置顶无边框窗口下，系统 confirm 常被挡在窗口后面，表现为「点击无任何反应」
    if (file.sensitive && !window.dropzone?.isElectron) {
      if (!window.confirm('疑似敏感文件，确认继续改名吗？')) return;
    }
    if (!onAdoptRename) {
      showToast('改名处理器未初始化，请刷新应用重试');
      return;
    }
    if (!editedName.trim()) {
      showToast('文件名不能为空');
      return;
    }
    setAdopting(true);
    showToast('正在改名，请稍候…');
    try {
      await onAdoptRename(file, editedName, editedTags);
      showToast('已确认改名');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '改名失败');
    } finally {
      setAdopting(false);
    }
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="flex min-h-0 w-[58%] shrink-0 flex-col border-l border-white/45 bg-white/25 backdrop-blur-md"
    >
      <div className="flex items-start gap-3 border-b border-white/40 px-4 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-800">安全重命名建议</h2>
          <p className="text-xs text-slate-500">AI 仅提供建议，您拥有最终决定权</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-white/60 hover:text-slate-600"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {file.sensitive && (
        <div className="mx-4 mt-3 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs font-medium text-red-600">
          疑似敏感文件，请确认后再操作
        </div>
      )}

      {file.status === 'error' && file.parseError && (
        <div className="mx-4 mt-3 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs leading-relaxed text-red-700">
          {file.parseError}
        </div>
      )}

      {!isMockMode() && !file.sourcePath && file.status !== 'error' && (
        <div className="mx-4 mt-3 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs leading-relaxed text-red-700">
          未检测到磁盘路径。请从桌面或资源管理器直接拖入本窗口（勿经微信/QQ 转发）。
        </div>
      )}

      {!isMockMode() && file.sourcePath && (
        <div className="mx-4 mt-3 rounded-lg border border-white/50 bg-white/40 px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-400">磁盘路径</p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-600">{file.sourcePath}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          <NameBlock label="原文件名" name={file.name} extension={file.extension} />
          <div className="flex justify-center py-0.5">
            <ChevronDown className="h-5 w-5 text-blue-500" strokeWidth={2.5} />
          </div>
          <NameBlock
            label="现文件名"
            name={file.suggestedName}
            extension={file.extension}
            aiBadge
            highlight
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            手动修改（可编辑）
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              value={editedName}
              onChange={e => setEditedName(e.target.value)}
              maxLength={255}
              className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 pr-14 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {editedName.length}/255
            </span>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-semibold text-slate-500">标签</label>
          <div className="flex flex-wrap gap-2">
            {editedTags.map(tag => (
              <TagChip
                key={tag}
                label={tag}
                variant={tag === 'sensitive' ? 'sensitive' : 'default'}
                onRemove={() => setEditedTags(prev => prev.filter(t => t !== tag))}
              />
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="+ 添加标签"
              className="w-24 rounded-full border border-dashed border-slate-300 bg-transparent px-2.5 py-0.5 text-xs text-slate-500 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-xs font-semibold text-emerald-800/80">建议原因</p>
            <CategoryReasonBlock
              summary={file.categoryReason}
              lastExtraPrompt={file.lastExtraPrompt}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div className="shrink-0 border-t border-white/35 bg-white/30 px-4 py-2">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">{toast}</p>
        </div>
      )}

      {regenOpen && (
        <div className="border-t border-white/40 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">本次补充说明（可选）</p>
          <textarea
            value={extraPrompt}
            onChange={e => setExtraPrompt(e.target.value)}
            placeholder="例如：强调算法名、突出实验版本"
            maxLength={500}
            rows={3}
            disabled={regenerating}
            className="w-full resize-y rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={regenerating}
              onClick={() => void handleRegenerateSubmit()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? '生成中…' : '开始生成'}
            </button>
            <button
              type="button"
              disabled={regenerating}
              onClick={() => setRegenOpen(false)}
              className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600 hover:bg-white disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-white/40 p-4">
        <button
          type="button"
          disabled={!canRegenerate || adopting || regenerating || regenOpen}
          title={
            isMockMode()
              ? '关闭 Mock 并使用 electron:dev:full 后可重生成'
              : !file.parseMetadata
                ? '请重新拖入该文件'
                : undefined
          }
          onClick={() => setRegenOpen(true)}
          className="flex items-center justify-center gap-1 rounded-xl border border-violet-200/80 bg-violet-50/90 py-2.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重新生成
        </button>
        <button
          type="button"
          disabled={adopting || regenerating}
          onClick={() => void handleAdopt()}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" />
          {adopting ? '处理中…' : '确认改名'}
        </button>
        <button
          type="button"
          disabled={regenerating}
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 py-2.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-60"
        >
          <Ban className="h-3.5 w-3.5" />
          忽略
        </button>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-3 text-[11px] text-slate-400">
        <Lock className="h-3 w-3 shrink-0" />
        <span>系统仅提供命名建议，确认前不会修改原始文件</span>
      </p>
    </motion.aside>
  );
}

function NameBlock({
  label,
  name,
  extension,
  aiBadge,
  highlight,
}: {
  label: string;
  name: string;
  extension: string;
  aiBadge?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-sm ${
        highlight
          ? 'border-emerald-100/80 bg-emerald-50/50'
          : 'border-white/60 bg-white/75'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          highlight ? 'bg-emerald-100/80 text-emerald-700' : 'bg-slate-100 text-blue-600'
        }`}
      >
        {aiBadge ? (
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <FileIcon extension={extension} className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">{label}</span>
          {aiBadge && (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
              AI 建议
            </span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
      </div>
    </div>
  );
}
