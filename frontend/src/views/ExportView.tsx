import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Package, Search } from 'lucide-react';
import type { TagSearchFileItem } from '../api/types';
import type { FileItem } from '../types/fileItem';
import {
  exportZip,
  fetchTagsLibrary,
  isMockMode,
  searchTags,
} from '../services/dropzoneApi';
import { SearchResultFileRow } from '../components/SearchResultFileRow';
import { TagChip } from '../components/TagChip';
import { formatApiError } from '../utils/apiErrors';

const STORAGE_OUTPUT = 'aidropzone.export_output_dir';
const SEARCH_DEBOUNCE_MS = 300;

interface Props {
  files: FileItem[];
  onBack: () => void;
  onExported?: (zipPath: string, tags: string[]) => void;
}

function mockSearchFiles(sessionFiles: FileItem[], tags: string[]): TagSearchFileItem[] {
  const selected = new Set(tags);
  return sessionFiles
    .filter(f => f.tags.some(t => selected.has(t)))
    .map(f => ({
      path: f.sourcePath || f.name,
      name: f.name,
      size_bytes: 0,
      tags: f.tags.filter(t => t !== 'sensitive'),
    }));
}

export function ExportView({ files, onBack, onExported }: Props) {
  const [tagLibrary, setTagLibrary] = useState<Record<string, number>>({});
  const [tagsLoading, setTagsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<TagSearchFileItem[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [outputDir, setOutputDir] = useState(
    () => localStorage.getItem(STORAGE_OUTPUT) ?? '',
  );
  const [packageName, setPackageName] = useState('export');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const allTags = useMemo(() => {
    const entries = Object.entries(tagLibrary)
      .filter(([tag]) => tag !== 'sensitive')
      .sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [tagLibrary]);

  useEffect(() => {
    let mounted = true;
    setTagsLoading(true);
    setError(null);

    if (isMockMode()) {
      const counts: Record<string, number> = {};
      for (const f of files) {
        for (const t of f.tags) {
          if (t === 'sensitive') continue;
          counts[t] = (counts[t] ?? 0) + 1;
        }
      }
      if (mounted) {
        setTagLibrary(counts);
        setTagsLoading(false);
      }
      return () => {
        mounted = false;
      };
    }

    void fetchTagsLibrary()
      .then(res => {
        if (!mounted) return;
        if (res.status !== 'success' || !res.tags) {
          throw new Error(res.error ?? '加载标签库失败');
        }
        setTagLibrary(res.tags);
      })
      .catch(err => {
        if (!mounted) return;
        setError(formatApiError(err));
      })
      .finally(() => {
        if (mounted) setTagsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [files]);

  const runSearch = useCallback(
    async (tags: string[]) => {
      if (tags.length === 0) {
        setSearchResults([]);
        setSelectedPaths(new Set());
        return;
      }

      const seq = ++searchSeq.current;
      setSearching(true);
      setError(null);

      try {
        let results: TagSearchFileItem[];

        if (isMockMode()) {
          results = mockSearchFiles(files, tags);
        } else {
          const res = await searchTags({ tags, match_mode: 'any' });
          if (res.status !== 'success') {
            throw new Error(res.error ?? '搜索失败');
          }
          results = res.files ?? [];
        }

        if (seq !== searchSeq.current) return;

        setSearchResults(results);
        setSelectedPaths(new Set(results.map(f => f.path)));
      } catch (err) {
        if (seq !== searchSeq.current) return;
        setSearchResults([]);
        setSelectedPaths(new Set());
        setError(formatApiError(err));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    },
    [files],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(selectedTags);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [selectedTags, runSearch]);

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
    setResult(null);
  }

  function togglePath(path: string) {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedPaths.size === searchResults.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(searchResults.map(f => f.path)));
    }
  }

  async function handleExport() {
    const paths = [...selectedPaths];
    if (paths.length === 0) {
      setError('请至少勾选一个文件');
      return;
    }
    if (!outputDir.trim()) {
      setError('请填写 zip 输出目录（绝对路径）');
      return;
    }

    if (isMockMode()) {
      const zipPath = `${outputDir.trim().replace(/[/\\]+$/, '')}\\${packageName.trim() || 'export'}.zip`;
      setResult(`[Mock] 已模拟打包 ${paths.length} 个文件 → ${zipPath}`);
      onExported?.(zipPath, selectedTags);
      return;
    }

    setExporting(true);
    setError(null);
    setResult(null);
    try {
      localStorage.setItem(STORAGE_OUTPUT, outputDir.trim());
      const res = await exportZip({
        file_paths: paths,
        output_dir: outputDir.trim(),
        package_name: packageName.trim() || 'export',
        include_manifest: true,
      });

      if (res.status !== 'success' || !res.zip_path) {
        const msg = res.errors[0]?.error ?? '导出失败';
        throw new Error(msg);
      }

      const total = res.manifest?.total_files ?? paths.length;
      setResult(`已生成 ${res.zip_path}（${total} 个文件）`);
      onExported?.(res.zip_path, selectedTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  const allSelected =
    searchResults.length > 0 && selectedPaths.size === searchResults.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="electron-no-drag flex min-h-0 flex-1 flex-col"
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
        <div>
          <h2 className="text-sm font-bold text-slate-800">搜索与打包</h2>
          <p className="text-[11px] text-slate-500">按标签搜索 workspace 文件，勾选后打包</p>
        </div>
      </div>

      <div className="electron-no-drag flex-1 overflow-y-auto p-4">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          命中<strong>任意</strong>所选标签的文件会出现在下方列表（OR 搜索）。勾选后打包，仅包含 workspace
          内文件。
        </p>

        <label className="mb-2 block text-xs font-semibold text-slate-500">选择标签</label>
        {tagsLoading ? (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载标签库…
          </p>
        ) : allTags.length === 0 ? (
          <p className="mb-4 text-xs text-slate-400">
            workspace 暂无可用标签，请先拖入并改名归档文件。
          </p>
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {allTags.map(([tag, count]) => (
              <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                <TagChip
                  label={`${tag} (${count})`}
                  variant={selectedTags.includes(tag) ? 'default' : 'status-stashed'}
                />
              </button>
            ))}
          </div>
        )}

        {selectedTags.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Search className="h-3.5 w-3.5" />
                搜索结果
                {searching && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
              </label>
              {searchResults.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  {allSelected ? '取消全选' : '全选'}
                </button>
              )}
            </div>

            {searchResults.length === 0 && !searching ? (
              <p className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-3 py-4 text-center text-xs text-slate-400">
                未找到匹配文件
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">
                  已选 {selectedPaths.size} / 共 {searchResults.length}
                </p>
                {searchResults.map(file => (
                  <SearchResultFileRow
                    key={file.path}
                    file={file}
                    checked={selectedPaths.has(file.path)}
                    onToggle={() => togglePath(file.path)}
                  />
                ))}
              </div>
            )}
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
          disabled={exporting || selectedPaths.size === 0}
          onClick={() => void handleExport()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          {exporting ? '打包中…' : `打包选中文件 (${selectedPaths.size})`}
        </button>
      </div>
    </motion.div>
  );
}
