/** 撤销快照：前端内存，Mock/无后端时由 UI 直接恢复 */
import type { RenamedEntry, RenameItem } from './types';
import type { PipelineCard } from '../hooks/pipelineTypes';

export interface UndoPathEntry {
  cardId: string;
  oldPath: string;
  newPath: string;
}

let lastRenameSnapshot: UndoPathEntry[] = [];

export function normalizePath(p: string): string {
  return p.replace(/\//g, '\\').trim().toLowerCase();
}

export function pathsEqual(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

function fileBaseName(p: string): string {
  const norm = normalizePath(p);
  const idx = norm.lastIndexOf('\\');
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

export function buildRenameItemsFromCards(cards: PipelineCard[]): RenameItem[] {
  return cards
    .filter((c) => c.status === 'complete' && c.suggested_name)
    .map((c) => ({
      source_path: c.metadata.path,
      new_name: c.suggested_name!,
      tags_applied: c.tags.length > 0 ? c.tags : ['file'],
      notes: '',
    }));
}

/**
 * 从确认/预览返回的 renamed 列表建立撤销快照（与 API 的 old 字段对齐）。
 */
export function buildRenameUndoFromRenamed(
  cards: PipelineCard[],
  renamed: RenamedEntry[],
): UndoPathEntry[] {
  const snapshot: UndoPathEntry[] = [];

  for (const entry of renamed) {
    const card = cards.find(
      (c) =>
        pathsEqual(c.metadata.path, entry.old) ||
        fileBaseName(c.metadata.path) === fileBaseName(entry.old),
    );
    if (!card) continue;

    snapshot.push({
      cardId: card.id,
      oldPath: card.metadata.path,
      newPath: entry.new,
    });
  }

  return snapshot;
}

/**
 * 卡片已写入新路径但撤销快照丢失时，用预览里的 old/new 恢复路径以便再次预览。
 */
export function recoverCardsFromRenamePreview(
  cards: PipelineCard[],
  preview: RenamedEntry[],
): PipelineCard[] | null {
  if (preview.length === 0) return null;

  let recovered = false;
  const next = cards.map((card) => {
    if (!card.is_renamed) return card;

    const entry = preview.find(
      (p) =>
        pathsEqual(p.new, card.metadata.path) ||
        fileBaseName(p.new) === fileBaseName(card.metadata.path),
    );
    if (!entry) return card;

    recovered = true;
    return {
      ...card,
      metadata: { ...card.metadata, path: entry.old },
      is_renamed: false,
      summary: '已恢复路径，可重新预览改名。',
    };
  });

  return recovered ? next : null;
}

/**
 * 按「可改名卡片」逐项对齐预览/确认结果，不依赖 setState 时序。
 */
export function buildRenameUndoEntries(
  cards: PipelineCard[],
  preview: RenamedEntry[],
  confirmed?: RenamedEntry[],
): UndoPathEntry[] {
  const snapshot: UndoPathEntry[] = [];
  const items = buildRenameItemsFromCards(cards);

  for (const item of items) {
    const card = cards.find((c) => pathsEqual(c.metadata.path, item.source_path));
    if (!card) continue;

    const oldPath = card.metadata.path;
    const previewEntry = preview.find(
      (p) =>
        pathsEqual(p.old, oldPath) ||
        pathsEqual(p.old, item.source_path) ||
        fileBaseName(p.old) === fileBaseName(oldPath),
    );
    const confirmedEntry = confirmed?.find(
      (r) =>
        pathsEqual(r.old, oldPath) ||
        pathsEqual(r.old, item.source_path) ||
        (previewEntry && pathsEqual(r.old, previewEntry.old)),
    );

    if (!previewEntry && !confirmedEntry) continue;

    snapshot.push({
      cardId: card.id,
      oldPath,
      newPath: confirmedEntry?.new ?? previewEntry!.new,
    });
  }

  return snapshot;
}

export function applyRenameToCards(
  cards: PipelineCard[],
  snapshot: UndoPathEntry[],
): PipelineCard[] {
  return cards.map((card) => {
    const entry = snapshot.find((s) => s.cardId === card.id);
    if (!entry) return card;
    return {
      ...card,
      metadata: { ...card.metadata, path: entry.newPath },
      is_renamed: true,
      summary: '已确认改名（Mock 模拟，未实际写盘）。',
    };
  });
}

export function applyUndoToCards(
  cards: PipelineCard[],
  snapshot: UndoPathEntry[],
): PipelineCard[] {
  return cards.map((card) => {
    const entry = snapshot.find((s) => s.cardId === card.id);
    if (!entry) return card;
    return {
      ...card,
      metadata: { ...card.metadata, path: entry.oldPath },
      is_renamed: false,
      summary: '已撤销改名，路径已恢复。',
    };
  });
}

export function setLastRenameSnapshot(entries: UndoPathEntry[]): void {
  lastRenameSnapshot = entries.map((e) => ({ ...e }));
}

export function getLastRenameSnapshot(): UndoPathEntry[] {
  return lastRenameSnapshot.map((e) => ({ ...e }));
}

export function clearLastRenameSnapshot(): void {
  lastRenameSnapshot = [];
}

/** HTTP /undo 成功时：按 undone[].new_path 匹配卡片并恢复为 original_path */
export function applyUndoFromApiEntries(
  cards: PipelineCard[],
  undone: Array<{ original_path: string; new_path: string }>,
): PipelineCard[] {
  return cards.map((card) => {
    const entry = undone.find(
      (u) =>
        pathsEqual(card.metadata.path, u.new_path) ||
        fileBaseName(card.metadata.path) === fileBaseName(u.new_path),
    );
    if (!entry) return card;
    return {
      ...card,
      metadata: { ...card.metadata, path: entry.original_path },
      is_renamed: false,
      summary: '已撤销改名，路径已恢复。',
    };
  });
}
