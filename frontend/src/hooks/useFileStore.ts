import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { FileMetadata } from '../api/types';
import {
  createPlaceholderFromDrop,
  delay,
  fileDropKey,
  mockParseFromFile,
  MOCK_PARSE_DELAY_MS,
} from '../mock/mockParse';
import { isMockMode, parseOne, regenerateOne } from '../services/dropzoneApi';
import type { FileItem } from '../types/fileItem';
import { formatApiError, isNetworkFetchError } from '../utils/apiErrors';
import { resolveDroppedFilePath } from '../utils/electronPath';
import { metadataFromDroppedFile } from '../utils/fileMetadataFromDrop';
import { pathLooksAbsolute } from '../utils/pathLooksAbsolute';

const COMPLETE_FLASH_MS = 1500;

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function canResolvePath(): boolean {
  return Boolean(window.dropzone?.isElectron);
}

function flashJustCompleted(id: string, setFiles: Dispatch<SetStateAction<FileItem[]>>) {
  setFiles(prev => prev.map(f => (f.id === id ? { ...f, justCompleted: true } : f)));
  window.setTimeout(() => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, justCompleted: false } : f)));
  }, COMPLETE_FLASH_MS);
}

function resolveMetadata(file: File, knownPath: string): FileMetadata | null {
  if (!knownPath.trim()) return null;
  return metadataFromDroppedFile(file, knownPath);
}

export function useFileStore() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const filesRef = useRef<FileItem[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const runParse = useCallback(async (file: File, itemId: string, sourcePath = '') => {
    const useMock = isMockMode() || !canResolvePath();

    if (useMock) {
      await delay(MOCK_PARSE_DELAY_MS);
      const parsed = mockParseFromFile(file);
      const mockMeta =
        sourcePath.trim() ? metadataFromDroppedFile(file, sourcePath) : undefined;
      setFiles(prev =>
        prev.map(f =>
          f.id === itemId
            ? {
                ...f,
                ...parsed,
                parseMetadata: mockMeta,
                status: 'processed' as const,
                parseError: undefined,
              }
            : f,
        ),
      );
      flashJustCompleted(itemId, setFiles);
      return;
    }

    try {
      if (!sourcePath.trim()) {
        throw new Error(
          '无法读取文件路径。请从桌面或资源管理器直接拖入本窗口（勿经微信/QQ 转发）。',
        );
      }

      const metadata = resolveMetadata(file, sourcePath);
      if (!metadata) {
        throw new Error('无法构建文件元数据');
      }

      const result = await parseOne(metadata, false);
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.error ?? '解析失败');
      }
      const data = result.data;
      const sensitive = data.tags.includes('sensitive');
      const apiPath = data.file_path.trim();
      const nextSourcePath = pathLooksAbsolute(apiPath) ? apiPath : sourcePath.trim();
      setFiles(prev =>
        prev.map(f =>
          f.id === itemId
            ? {
                ...f,
                sourcePath: nextSourcePath,
                name: metadata.name_before_drop,
                suggestedName: data.suggested_name,
                tags: data.tags,
                categoryReason: data.summary,
                extension: extOf(metadata.name_before_drop),
                parseCategory: data.category,
                sensitive,
                parseMetadata: metadata,
                lastExtraPrompt: undefined,
                status: 'processed' as const,
                parseError: undefined,
              }
            : f,
        ),
      );
      flashJustCompleted(itemId, setFiles);
    } catch (err) {
      if (isNetworkFetchError(err) && sourcePath.trim()) {
        const parsed = mockParseFromFile(file, sourcePath);
        const fallbackMeta = metadataFromDroppedFile(file, sourcePath);
        setFiles(prev =>
          prev.map(f =>
            f.id === itemId
              ? {
                  ...f,
                  ...parsed,
                  sourcePath: sourcePath.trim(),
                  parseMetadata: fallbackMeta,
                  status: 'processed' as const,
                  parseError: undefined,
                  categoryReason:
                    (parsed.categoryReason ?? '') +
                    '（后端未连接，已用本地 Mock 解析；启动 uvicorn 或开启设置里的 Mock 可消除此提示）',
                }
              : f,
          ),
        );
        flashJustCompleted(itemId, setFiles);
        return;
      }

      const message = formatApiError(err);
      setFiles(prev =>
        prev.map(f =>
          f.id === itemId ? { ...f, status: 'error' as const, parseError: message } : f,
        ),
      );
    }
  }, []);

  const addFiles = useCallback(
    (dropped: File[]) => {
      /**
       * Electron：`webUtils.getPathForFile` 必须在拖放事件的同步调用栈内执行。
       * 若放在 `setState` updater 里，React 可能延后执行，路径会恒为空 → 你看到「无法读取文件路径」。
       */
      /** sourcePath 应在 drop 同步栈内由 dropzoneGetFilesFromEvent / BallShell 写入 WeakMap */
      const enriched = dropped.map(file => ({
        file,
        dropKey: fileDropKey(file),
        sourcePath: resolveDroppedFilePath(file),
      }));

      const existingKeys = new Set(filesRef.current.map(f => f.dropKey));
      const seenInBatch = new Set<string>();
      const newItems: FileItem[] = [];
      const toParse: { file: File; id: string; sourcePath: string }[] = [];

      for (const row of enriched) {
        if (existingKeys.has(row.dropKey) || seenInBatch.has(row.dropKey)) continue;
        seenInBatch.add(row.dropKey);
        existingKeys.add(row.dropKey);
        const item = createPlaceholderFromDrop(row.file, row.sourcePath);
        newItems.push(item);
        toParse.push({ file: row.file, id: item.id, sourcePath: row.sourcePath });
      }

      if (newItems.length === 0) return [];

      setFiles(prev => [...newItems, ...prev]);

      for (const t of toParse) {
        void runParse(t.file, t.id, t.sourcePath);
      }
      return newItems.map(item => item.id);
    },
    [runParse],
  );

  const updateFile = useCallback((id: string, patch: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const regenerateFile = useCallback(
    async (fileId: string, extraPrompt: string, contextTags: string[]) => {
      if (isMockMode() || !canResolvePath()) {
        throw new Error('重新生成需要关闭 Mock 并使用 electron:dev:full 连接本地后端。');
      }

      const item = filesRef.current.find(f => f.id === fileId);
      if (!item?.parseMetadata) {
        throw new Error('缺少文件元数据，请重新拖入该文件后再试。');
      }

      const result = await regenerateOne(
        item.parseMetadata,
        extraPrompt.trim(),
        contextTags,
      );
      if (result.status !== 'success' || !result.data) {
        throw new Error(result.error ?? '重新生成失败');
      }

      const data = result.data;
      const sensitive = data.tags.includes('sensitive');
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? {
                ...f,
                suggestedName: data.suggested_name,
                categoryReason: data.summary,
                parseCategory: data.category,
                lastExtraPrompt: extraPrompt.trim() || undefined,
                sensitive,
                parseError: undefined,
              }
            : f,
        ),
      );
      flashJustCompleted(fileId, setFiles);
    },
    [],
  );

  const flashFileCompleted = useCallback((id: string) => {
    flashJustCompleted(id, setFiles);
  }, []);

  const removeSelection = useCallback(() => setSelectedFileId(null), []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelectedFileId(prev => (prev === id ? null : prev));
  }, []);

  const syncAfterUndoRename = useCallback((originalPath: string, formerNewPath?: string) => {
    const base = originalPath.split(/[/\\]/).pop() ?? originalPath;
    setFiles(prev =>
      prev.map(f => {
        const match =
          (formerNewPath && f.sourcePath === formerNewPath) ||
          f.sourcePath === originalPath ||
          (formerNewPath && f.name === formerNewPath.split(/[/\\]/).pop());
        if (!match) return f;
        return { ...f, sourcePath: originalPath, name: base };
      }),
    );
  }, []);

  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const hasFiles = files.length > 0;
  const isDetailOpen = selectedFileId !== null;

  return {
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
    flashFileCompleted,
    removeFile,
    syncAfterUndoRename,
  };
}
