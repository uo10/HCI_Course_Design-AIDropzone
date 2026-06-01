import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import type { FileItem } from '../types/fileItem';
import { exportZip, isMockMode } from '../services/dropzoneApi';
import { TagChip } from '../components/TagChip';

const STORAGE_OUTPUT = 'aidropzone.export_output_dir';

interface Props {
  files: FileItem[];
  onBack: () => void;
  onExported?: (zipPath: string, tags: string[]) => void;
}

export function ExportView({ files, onBack, onExported }: Props) {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      for (const t of f.tags) {
        if (t !== 'sensitive') set.add(t);
      }
    }
    return [...set].sort();
  }, [files]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState(
    () => localStorage.getItem(STORAGE_OUTPUT) ?? '',
  );
  const [packageName, setPackageName] = useState('export');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }

  async function handleExport() {
    if (selectedTags.length === 0) {
      setError('请至少选择一个标签');
      return;
    }
    if (!outputDir.trim()) {
      setError('请填写 zip 输出目录（绝对路径）');
      return;
    }

    if (isMockMode()) {
      const zipPath = `${outputDir.trim().replace(/[/\\]+$/, '')}\\${packageName.trim() || 'export'}.zip`;
      setResult(`[Mock] 已模拟打包 ${selectedTags.join(' + ')} → ${zipPath}`);
      onExported?.(zipPath, selectedTags);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      localStorage.setItem(STORAGE_OUTPUT, outputDir.trim());
      const res = await exportZip({
        tags: selectedTags,
        output_dir: outputDir.trim(),
        package_name: packageName.trim() || 'export',
        include_manifest: true,
      });

      if (res.status !== 'success' || !res.zip_path) {
        const msg = res.errors[0]?.error ?? '导出失败或无匹配文件';
        throw new Error(msg);
      }

      const total = res.manifest?.total_files ?? 0;
      if (total === 0) {
        throw new Error('未匹配到任何文件，请确认文件已改名且位于 workspace 内');
      }

      setResult(`已生成 ${res.zip_path}（${total} 个文件）`);
      onExported?.(res.zip_path, selectedTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-2 border-b border-white/40 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1.5 text-slate-500 hover:bg-white/50 hover:text-slate-700"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-slate-800">打包导出</h2>
          <p className="text-[11px] text-slate-500">按标签筛选 workspace 内文件并生成 zip</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          后端将扫描{' '}
          <code className="rounded bg-white/60 px-1">workspace</code>{' '}
          目录中文件名包含<strong>全部</strong>所选标签的文件。请确保已改名且文件在整理篮内。
        </p>

        <label className="mb-2 block text-xs font-semibold text-slate-500">选择标签（AND）</label>
        {allTags.length === 0 ? (
          <p className="mb-4 text-xs text-slate-400">当前会话暂无可用标签，请先拖入并解析文件。</p>
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {allTags.map(tag => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                <TagChip
                  label={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'status-stashed'}
                />
              </button>
            ))}
          </div>
        )}

        <label className="mb-1.5 block text-xs font-semibold text-slate-500">输出目录</label>
        <input
          value={outputDir}
          onChange={e => setOutputDir(e.target.value)}
          placeholder="例如 D:\exports"
          className="mb-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        <label className="mb-1.5 block text-xs font-semibold text-slate-500">压缩包名称</label>
        <input
          value={packageName}
          onChange={e => setPackageName(e.target.value)}
          placeholder="export"
          className="mb-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
        {result && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>
        )}

        <button
          type="button"
          disabled={loading || selectedTags.length === 0}
          onClick={() => void handleExport()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          {loading ? '打包中…' : '开始打包'}
        </button>
      </div>
    </motion.div>
  );
}
