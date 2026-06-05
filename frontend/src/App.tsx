import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { GlassShell, type AppView } from './components/GlassShell';
import { DropzoneArea } from './components/DropzoneArea';
import { FileList } from './components/FileList';
import { FileDetailPanel } from './components/FileDetailPanel';
import { useFileStore } from './hooks/useFileStore';
import { useActivityLog } from './hooks/useActivityLog';
import { ActivityLogView } from './views/ActivityLogView';
import { SettingsView } from './views/SettingsView';
import { ExportView } from './views/ExportView';
import { ApiModeBanner } from './components/ApiModeBanner';
import { BallShell } from './components/BallShell';
import { isMockMode, rename } from './services/dropzoneApi';
import type { FileItem } from './types/fileItem';

function extFromFilename(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/** 兼容后端 /rename 返回的 renamed 项字段差异 */
function pickRenamedNewPath(first: unknown): string | null {
  if (!first || typeof first !== 'object') return null;
  const o = first as Record<string, unknown>;
  for (const key of ['new', 'new_path', 'target', 'dst'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

/** 当响应里缺少 new 路径时，用原路径的目录 + 新文件名拼一条（与 Windows 展示一致） */
function siblingPathWithNewBasename(sourcePath: string, newBasename: string): string {
  const norm = sourcePath.trim().replace(/[/\\]+$/, '');
  const idx = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'));
  if (idx < 0) return newBasename;
  return norm.slice(0, idx + 1) + newBasename;
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [shellMode, setShellMode] = useState<'ball' | 'panel'>(() =>
    window.dropzone?.isElectron ? 'ball' : 'panel',
  );
  const {
    files,
    selectedFileId,
    selectedFile,
    hasFiles,
    isDetailOpen,
    setSelectedFileId,
    addFiles,
    updateFile,
    regenerateFile,
    removeSelection,
    removeFile,
    syncAfterUndoRename,
  } = useFileStore();

  const { entries, loading, error, refresh, addEntry, undoEntry } = useActivityLog();

  useEffect(() => {
    if (!window.dropzone?.isElectron) return;
    let mounted = true;
    void window.dropzone.getShellMode().then(mode => {
      if (mounted) setShellMode(mode);
    });
    const off = window.dropzone.onShellModeChanged(mode => setShellMode(mode));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (window.dropzone?.isElectron && shellMode === 'ball') {
      root.classList.add('electron-ball-mode');
      document.title = '';
    } else {
      root.classList.remove('electron-ball-mode');
      if (window.dropzone?.isElectron) {
        document.title = 'AI Dropzone';
      }
    }
    return () => root.classList.remove('electron-ball-mode');
  }, [shellMode]);

  async function handleAdoptRename(file: FileItem, newName: string, tags: string[]) {
    // Avoid "click with no response" when backend rename hangs.
    const withTimeout = async <T,>(p: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
      let t: number | undefined;
      try {
        const timeoutPromise = new Promise<T>((_, reject) => {
          t = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
        });
        return await Promise.race([p, timeoutPromise]);
      } finally {
        if (t != null) window.clearTimeout(t);
      }
    };

    const baseName = newName.replace(/^.*[/\\]/, '').trim();
    if (!baseName) {
      throw new Error('新文件名为空');
    }

    if (!isMockMode()) {
      if (!file.sourcePath) {
        throw new Error(
          '无法获取桌面文件路径。请用 Electron 启动：npm run electron:dev:full（不要用浏览器直接打开 5173）。',
        );
      }
      if (!window.dropzone?.isElectron) {
        throw new Error(
          '当前不是 Electron 窗口，浏览器无法访问磁盘路径。请运行 npm run electron:dev:full。',
        );
      }

      const resWithTimeout = await withTimeout(
        rename({
          items: [
            {
              source_path: file.sourcePath,
              new_name: baseName,
              tags_applied: tags.filter(t => t !== 'sensitive'),
            },
          ],
          naming: { pattern: '{name}', separator: '_', case: 'preserve' },
          conflict_mode: 'auto_increment',
        }),
        12000,
        '改名请求超时，请稍后重试',
      );
      if (resWithTimeout.status !== 'success' || resWithTimeout.errors.length > 0) {
        throw new Error(resWithTimeout.errors[0]?.error ?? '改名失败');
      }
      const first = resWithTimeout.renamed[0] as unknown;
      const picked = pickRenamedNewPath(first);
      const newPath =
        picked ?? siblingPathWithNewBasename(file.sourcePath, baseName);
      const displayName = newPath.split(/[/\\]/).pop() ?? baseName;
      const nextExt = extFromFilename(displayName) || file.extension;
      updateFile(file.id, {
        name: displayName,
        suggestedName: displayName,
        tags,
        status: 'processed',
        sourcePath: newPath,
        extension: nextExt,
      });
      addEntry({
        operation: 'rename',
        originalPath: file.sourcePath,
        newPath,
        label: `${file.name} → ${displayName}`,
      });
      return;
    }

    const mockExt = extFromFilename(baseName) || file.extension;
    updateFile(file.id, {
      name: baseName,
      suggestedName: baseName,
      tags,
      status: 'processed',
      extension: mockExt,
    });
    addEntry({
      operation: 'rename',
      originalPath: file.sourcePath || file.name,
      newPath: baseName,
      label: `${file.name} → ${baseName}`,
    });
  }

  async function handleUndo(id: number) {
    const result = await undoEntry(id);
    if (result.ok) {
      const entry = entries.find(e => e.id === id);
      if (entry?.operation === 'rename') {
        syncAfterUndoRename(entry.originalPath, entry.newPath);
      }
    }
    return result;
  }

  function handleExported(zipPath: string, tags: string[]) {
    addEntry({
      operation: 'export',
      originalPath: tags.join(', '),
      newPath: zipPath,
      label: `导出 [${tags.join(', ')}]`,
    });
    void refresh();
  }

  if (window.dropzone?.isElectron && shellMode === 'ball') {
    return <BallShell onDropFiles={addFiles} />;
  }

  return (
    <GlassShell
      view={view}
      wide={view === 'home' && isDetailOpen}
      logCount={entries.length}
      onOpenActivityLog={() => setView('activityLog')}
      onOpenExport={() => setView('export')}
      onOpenSettings={() => setView('settings')}
    >
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <ApiModeBanner />
            <LayoutGroup id="app">
              <div
                className={`flex min-h-0 flex-1 ${isDetailOpen ? 'flex-row' : 'flex-col'}`}
                style={{ minHeight: hasFiles ? 460 : 340 }}
              >
                <div
                  className={`flex min-h-0 flex-col ${
                    isDetailOpen ? 'w-[42%] shrink-0 border-r border-white/35 p-0' : 'flex-1'
                  }`}
                >
                  <DropzoneArea hasFiles={hasFiles} onDropFiles={addFiles}>
                    {hasFiles && (
                      <FileList
                        files={files}
                        selectedFileId={selectedFileId}
                        onSelect={id => setSelectedFileId(id)}
                        onRemove={removeFile}
                      />
                    )}
                  </DropzoneArea>
                </div>

                <AnimatePresence mode="wait">
                  {isDetailOpen && selectedFile && (
                    <FileDetailPanel
                      key={selectedFile.id}
                      file={selectedFile}
                      onClose={removeSelection}
                      onAdoptRename={handleAdoptRename}
                      onRegenerate={(extraPrompt, contextTags) =>
                        regenerateFile(selectedFile.id, extraPrompt, contextTags)
                      }
                    />
                  )}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          </motion.div>
        )}

        {view === 'activityLog' && (
          <ActivityLogView
            key="log"
            entries={entries}
            loading={loading}
            error={error}
            onBack={() => setView('home')}
            onRefresh={refresh}
            onUndo={handleUndo}
          />
        )}

        {view === 'export' && (
          <ExportView
            key="export"
            files={files}
            onBack={() => setView('home')}
            onExported={handleExported}
          />
        )}

        {view === 'settings' && (
          <SettingsView key="settings" onBack={() => setView('home')} />
        )}
      </AnimatePresence>
    </GlassShell>
  );
}
