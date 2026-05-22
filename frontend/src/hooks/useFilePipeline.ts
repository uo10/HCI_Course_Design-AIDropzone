import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDemoPipelineCards } from '../api/demoCards';
import { getClient } from '../api/client';
import { alternateFileMetadata, sampleFileMetadata } from '../api/mockData';
import {
  applyRenameToCards,
  applyUndoFromApiEntries,
  applyUndoToCards,
  buildRenameUndoFromRenamed,
  clearLastRenameSnapshot,
  recoverCardsFromRenamePreview,
  setLastRenameSnapshot,
  type UndoPathEntry,
} from '../api/undoSnapshot';
import type {
  CardSortKey,
  ExportRequest,
  FileMetadata,
  RenamedEntry,
  RenameItem,
} from '../api/types';
import type { ProcessingMode } from '../components/ProcessingModeSwitch';
import type { ToastMessage, ToastVariant } from '../components/Toast';
import { getStatusSortOrder, withDisplayStatus } from '../utils/displayStatus';
import type { PipelineCard } from './pipelineTypes';

export type { PipelineCard } from './pipelineTypes';

export interface OperationLogEntry {
  id: string;
  time: string;
  message: string;
}

let simulateDropCounter = 0;
let operationLogCounter = 0;
let toastCounter = 0;

function createCardId(metadata: FileMetadata): string {
  return `${metadata.path}-${Date.now()}`;
}

function metadataForSimulateDrop(): FileMetadata {
  simulateDropCounter += 1;
  if (simulateDropCounter % 2 === 1) {
    return { ...sampleFileMetadata };
  }
  return { ...alternateFileMetadata };
}

function stashOrManualCard(
  id: string,
  metadata: FileMetadata,
  mode: ProcessingMode,
): PipelineCard {
  return withDisplayStatus({
    id,
    metadata,
    status: 'complete',
    source_mode: mode,
    suggested_name: metadata.name_before_drop,
    tags: [],
    summary:
      mode === 'stash_only'
        ? '仅暂存，未调用 AI 解析。可稍后手动整理或切换模式后重新拖入。'
        : '手动模式：请填写标签与目标文件名，再预览改名。',
    display_status: mode === 'stash_only' ? 'stashed' : 'manual_pending',
  });
}

export function useFilePipeline() {
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('ai_assisted');
  const [isBusy, setIsBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [renamePreview, setRenamePreview] = useState<RenamedEntry[] | null>(null);
  const [renameConfirmed, setRenameConfirmed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterSourceMode, setFilterSourceMode] = useState<ProcessingMode | 'all'>('all');
  const [sortKey, setSortKey] = useState<CardSortKey>('name');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [operations, setOperations] = useState<OperationLogEntry[]>([]);
  /** 撤销快照（React 状态，避免 HMR/模块单例丢失） */
  const [renameUndoSnapshot, setRenameUndoSnapshot] = useState<UndoPathEntry[]>(
    [],
  );
  const cardsRef = useRef<PipelineCard[]>(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const appendLog = useCallback((message: string) => {
    operationLogCounter += 1;
    const entry: OperationLogEntry = {
      id: `op-${operationLogCounter}`,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      message,
    };
    setOperations((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const showToast = useCallback((variant: ToastVariant, text: string) => {
    toastCounter += 1;
    const id = `toast-${toastCounter}`;
    setToasts((prev) => [...prev, { id, variant, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const patchCards = useCallback((updater: (prev: PipelineCard[]) => PipelineCard[]) => {
    setCards((prev) => updater(prev).map((c) => withDisplayStatus(c)));
    setRenamePreview(null);
    setRenameConfirmed(false);
  }, []);

  const updateCard = useCallback(
    (id: string, patch: Partial<PipelineCard>) => {
      patchCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [patchCards],
  );

  const updateCardTags = useCallback(
    (id: string, tags: string[]) => {
      updateCard(id, { tags });
    },
    [updateCard],
  );

  const updateCardSuggestedName = useCallback(
    (id: string, suggested_name: string) => {
      updateCard(id, { suggested_name });
    },
    [updateCard],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedCardId((prev) => (prev === id ? null : id));
  }, []);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const card of cards) {
      for (const tag of card.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  }, [cards]);

  const tagGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      for (const tag of card.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'zh-CN'));
  }, [cards]);

  const visibleCards = useMemo(() => {
    let list = [...cards];

    if (filterTag) {
      list = list.filter((c) => c.tags.includes(filterTag));
    }
    if (filterSourceMode !== 'all') {
      list = list.filter((c) => c.source_mode === filterSourceMode);
    }

    list.sort((a, b) => {
      if (sortKey === 'name') {
        return a.metadata.name_before_drop.localeCompare(
          b.metadata.name_before_drop,
          'zh-CN',
        );
      }
      if (sortKey === 'status') {
        return (
          getStatusSortOrder(a.display_status ?? 'parsing') -
          getStatusSortOrder(b.display_status ?? 'parsing')
        );
      }
      const tagA = a.tags[0] ?? '\uffff';
      const tagB = b.tags[0] ?? '\uffff';
      return tagA.localeCompare(tagB, 'zh-CN');
    });

    return list;
  }, [cards, filterTag, filterSourceMode, sortKey]);

  const buildRenameItems = useCallback((): RenameItem[] => {
    return cards
      .filter((c) => c.status === 'complete' && c.suggested_name)
      .map((c) => ({
        source_path: c.metadata.path,
        new_name: c.suggested_name!,
        tags_applied: c.tags.length > 0 ? c.tags : ['file'],
        notes: '',
      }));
  }, [cards]);

  const addFileFromMetadata = useCallback(
    async (metadata: FileMetadata) => {
      const id = createCardId(metadata);
      const duplicate = cards.some((c) => c.metadata.path === metadata.path);

      if (duplicate) {
        showToast('info', '该文件已在列表中，请勿重复拖入。');
        return;
      }

      setGlobalError(null);

      if (processingMode === 'stash_only' || processingMode === 'manual') {
        setCards((prev) => [
          ...prev,
          stashOrManualCard(id, metadata, processingMode),
        ]);
        showToast(
          'success',
          processingMode === 'stash_only'
            ? '文件已暂存。'
            : '文件已接收，请填写标签与文件名。',
        );
        appendLog(
          processingMode === 'stash_only'
            ? `暂存文件：${metadata.name_before_drop}`
            : `手动接收：${metadata.name_before_drop}`,
        );
        return;
      }

      const receivedCard: PipelineCard = withDisplayStatus({
        id,
        metadata,
        status: 'received',
        source_mode: 'ai_assisted',
        tags: [],
        display_status: 'parsing',
      });

      setCards((prev) => [...prev, receivedCard]);
      setIsBusy(true);

      setCards((prev) =>
        prev.map((c) =>
          c.id === id ? withDisplayStatus({ ...c, status: 'parsing' }) : c,
        ),
      );

      try {
        const result = await getClient().parse({
          file: metadata,
          prefer_mock: privacyMode,
        });

        if (result.status === 'success' && result.data) {
          const { data } = result;
          setCards((prev) =>
            prev.map((c) =>
              c.id === id
                ? withDisplayStatus({
                    ...c,
                    status: 'complete',
                    suggested_name: data.suggested_name,
                    category: data.category,
                    tags: [...data.tags],
                    summary: data.summary,
                    confidence: data.confidence,
                    error: undefined,
                  })
                : c,
            ),
          );
          showToast('success', 'AI 解析完成，请确认建议后预览改名。');
          appendLog(`AI 解析完成：${metadata.name_before_drop}`);
        } else {
          setCards((prev) =>
            prev.map((c) =>
              c.id === id
                ? withDisplayStatus({
                    ...c,
                    status: 'failure',
                    error:
                      result.error ??
                      '解析失败，请改用手动整理或仅暂存模式。',
                  })
                : c,
            ),
          );
          showToast('error', result.error ?? '解析失败，可改用手动整理或仅暂存。');
        }
      } catch {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? withDisplayStatus({
                  ...c,
                  status: 'failure',
                  error: '网络或程序异常，请稍后重试或改用手动整理。',
                })
              : c,
          ),
        );
        setGlobalError('部分文件解析失败，请查看卡片上的提示。');
        showToast('error', '解析异常，请改用手动整理或仅暂存。');
      } finally {
        setIsBusy(false);
      }
    },
    [cards, processingMode, privacyMode, showToast, appendLog],
  );

  const simulateDrop = useCallback(() => {
    void addFileFromMetadata(metadataForSimulateDrop());
  }, [addFileFromMetadata]);

  const handleFilesDropped = useCallback(
    async (files: FileMetadata[]) => {
      for (const metadata of files) {
        await addFileFromMetadata(metadata);
      }
    },
    [addFileFromMetadata],
  );

  const previewRename = useCallback(async () => {
    setRenameConfirmed(false);

    let cardsForPreview = cardsRef.current;
    const needsPathRecovery =
      renameUndoSnapshot.length === 0 &&
      renamePreview &&
      renamePreview.length > 0 &&
      cardsForPreview.some((c) => c.is_renamed);

    if (needsPathRecovery) {
      const recovered = recoverCardsFromRenamePreview(
        cardsForPreview,
        renamePreview,
      );
      if (recovered) {
        cardsForPreview = recovered;
        setCards(recovered.map((c) => withDisplayStatus(c)));
        setRenameConfirmed(false);
        showToast('info', '已恢复改名前的路径，正在重新生成预览。');
      }
    }

    const items = cardsForPreview
      .filter((c) => c.status === 'complete' && c.suggested_name)
      .map((c) => ({
        source_path: c.metadata.path,
        new_name: c.suggested_name!,
        tags_applied: c.tags.length > 0 ? c.tags : ['file'],
        notes: '',
      }));

    if (items.length === 0) {
      showToast('info', '没有可改名的已完成卡片，请先完成解析或填写文件名。');
      return;
    }

    setIsBusy(true);
    try {
      const result = await getClient().rename({
        items,
        dry_run: true,
        conflict_mode: 'auto_increment',
      });

      if (result.status === 'success' && result.renamed.length > 0) {
        setRenamePreview(result.renamed);
        setRenameConfirmed(false);
        setRenameUndoSnapshot([]);
        clearLastRenameSnapshot();
        showToast('success', '预览已生成，请核对新路径后确认改名。');
        appendLog(`预览改名 ${result.renamed.length} 项`);
      } else if (result.skipped.length > 0 && result.renamed.length === 0) {
        showToast('info', '所选文件路径与目标名相同，无需改名。');
      } else if (result.errors.length > 0) {
        const msg = result.errors.map((e) => e.error).join('；');
        showToast('error', msg || '预览改名失败，请检查文件名与标签。');
      } else {
        showToast('info', '没有产生改名预览，请检查文件是否已填写目标名。');
      }
    } catch {
      showToast('error', '预览改名请求失败，请稍后重试。');
    } finally {
      setIsBusy(false);
    }
  }, [renamePreview, renameUndoSnapshot.length, showToast, appendLog]);

  const loadDemoCards = useCallback(() => {
    setCards(buildDemoPipelineCards());
    setRenamePreview(null);
    setRenameConfirmed(false);
    setGlobalError(null);
    setExpandedCardId(null);
    clearLastRenameSnapshot();
    setRenameUndoSnapshot([]);
    appendLog('加载演示数据');
    showToast('success', '已加载演示数据，可直接筛选或预览改名。');
  }, [appendLog, showToast]);

  const exportByTags = useCallback(
    async (req: ExportRequest) => {
      if (!req.tags.length) {
        showToast('error', '请至少选择一个标签。');
        return;
      }
      if (!req.output_dir.trim()) {
        showToast('error', '请填写导出目录。');
        return;
      }

      setIsBusy(true);
      try {
        const result = await getClient().export(req);
        if (result.status === 'success' && result.zip_path) {
          const fileCount = result.manifest?.total_files ?? 0;
          if (fileCount === 0) {
            showToast(
              'info',
              `已生成 zip，但未打包任何文件（manifest 为空）。导出只扫描 backend/workspace 目录，且文件名须含标签 [${req.tags.join(', ')}]。请把已改名的文件复制到该目录后再导出。`,
            );
          } else {
            showToast(
              'success',
              `导出成功：${result.zip_path}（${fileCount} 个文件）`,
            );
          }
          appendLog(`导出标签 [${req.tags.join(', ')}]，${fileCount} 个文件`);
        } else {
          showToast('error', result.error ?? '导出失败，请稍后重试。');
        }
      } catch {
        showToast('error', '导出请求失败，请检查目录或稍后重试。');
      } finally {
        setIsBusy(false);
      }
    },
    [appendLog, showToast],
  );

  const confirmRename = useCallback(async () => {
    if (!renamePreview || renamePreview.length === 0) {
      showToast('info', '请先点击「预览改名」查看新路径。');
      return;
    }

    const items = buildRenameItems();
    const cardsAtConfirm = cardsRef.current;

    setIsBusy(true);
    try {
      const result = await getClient().rename({
        items,
        dry_run: false,
        conflict_mode: 'auto_increment',
      });

      if (result.status === 'success' && result.renamed.length > 0) {
        const snapshot = buildRenameUndoFromRenamed(
          cardsAtConfirm,
          result.renamed,
        );

        if (snapshot.length === 0) {
          showToast(
            'error',
            '无法建立撤销记录（预览与卡片未对齐），请重新加载演示数据后再预览、确认。',
          );
          return;
        }

        setRenameUndoSnapshot(snapshot);
        setLastRenameSnapshot(snapshot);
        setCards((prev) =>
          applyRenameToCards(prev, snapshot).map((c) => withDisplayStatus(c)),
        );
        setRenamePreview(result.renamed);
        setRenameConfirmed(true);

        appendLog(`确认改名 ${snapshot.length} 项`);
        showToast('success', `已确认改名 ${snapshot.length} 项，可点击「撤销改名」。`);
      } else {
        const msg =
          result.errors.map((e) => e.error).join('；') || '确认改名失败';
        showToast('error', msg);
      }
    } catch {
      showToast('error', '确认改名请求失败，请稍后重试。');
    } finally {
      setIsBusy(false);
    }
  }, [buildRenameItems, renamePreview, showToast, appendLog]);

  const undoLastOperation = useCallback(async () => {
    if (renameUndoSnapshot.length === 0) {
      showToast('info', '没有可撤销的改名，请先预览并确认改名。');
      return;
    }

    const snapshotCopy = renameUndoSnapshot.map((e) => ({ ...e }));

    setIsBusy(true);
    try {
      const result = await getClient().undo({
        count: snapshotCopy.length,
        filter_operation: 'rename',
      });

      if (result.status === 'success' && result.undone.length > 0) {
        setCards((prev) =>
          applyUndoFromApiEntries(prev, result.undone).map((c) =>
            withDisplayStatus(c),
          ),
        );
        appendLog(`撤销改名 ${result.undone.length} 项（后端同步）`);
        showToast(
          'success',
          `已撤销 ${result.undone.length} 项改名，路径已恢复。`,
        );
      } else {
        setCards((prev) =>
          applyUndoToCards(prev, snapshotCopy).map((c) => withDisplayStatus(c)),
        );
        appendLog(`撤销改名 ${snapshotCopy.length} 项（本地快照）`);
        showToast(
          'success',
          `已撤销 ${snapshotCopy.length} 项改名，路径已恢复。`,
        );
      }

      setRenamePreview(null);
      setRenameConfirmed(false);
      setRenameUndoSnapshot([]);
      clearLastRenameSnapshot();
    } catch {
      setCards((prev) =>
        applyUndoToCards(prev, snapshotCopy).map((c) => withDisplayStatus(c)),
      );
      setRenamePreview(null);
      setRenameConfirmed(false);
      setRenameUndoSnapshot([]);
      clearLastRenameSnapshot();
      appendLog(`撤销改名 ${snapshotCopy.length} 项（本地快照）`);
      showToast('success', `已撤销 ${snapshotCopy.length} 项改名，路径已恢复。`);
    } finally {
      setIsBusy(false);
    }
  }, [renameUndoSnapshot, appendLog, showToast]);

  const renamableCount = cards.filter(
    (c) => c.status === 'complete' && c.suggested_name,
  ).length;

  return {
    cards,
    visibleCards,
    allTags,
    tagGroups,
    filterTag,
    setFilterTag,
    filterSourceMode,
    setFilterSourceMode,
    sortKey,
    setSortKey,
    expandedCardId,
    toggleExpanded,
    processingMode,
    setProcessingMode,
    privacyMode,
    setPrivacyMode,
    operations,
    undoAvailable: renameUndoSnapshot.length > 0,
    isBusy,
    globalError,
    renamePreview,
    renameConfirmed,
    renamableCount,
    toasts,
    dismissToast,
    loadDemoCards,
    exportByTags,
    undoLastOperation,
    addFileFromMetadata,
    simulateDrop,
    handleFilesDropped,
    showToast,
    updateCardTags,
    updateCardSuggestedName,
    previewRename,
    confirmRename,
  };
}
