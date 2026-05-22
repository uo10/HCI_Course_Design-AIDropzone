import type { FileCardViewModel, FileDisplayStatus } from '../api/types';

const STATUS_SORT_ORDER: Record<FileDisplayStatus, number> = {
  failed: 0,
  parsing: 1,
  manual_pending: 2,
  stashed: 3,
  manual_ready: 4,
  parsed: 5,
  renamed: 6,
};

export function getStatusSortOrder(status: FileDisplayStatus): number {
  return STATUS_SORT_ORDER[status];
}

export function deriveDisplayStatus(card: FileCardViewModel): FileDisplayStatus {
  if (card.is_renamed) return 'renamed';
  if (card.status === 'failure') return 'failed';
  if (card.status === 'parsing' || card.status === 'received') return 'parsing';

  if (card.source_mode === 'stash_only') return 'stashed';

  if (card.source_mode === 'manual') {
    return card.tags.length > 0 ? 'manual_ready' : 'manual_pending';
  }

  if (card.source_mode === 'ai_assisted' && card.status === 'complete') {
    return 'parsed';
  }

  return 'parsing';
}

export function withDisplayStatus<T extends FileCardViewModel>(card: T): T {
  return { ...card, display_status: deriveDisplayStatus(card) };
}

export const DISPLAY_STATUS_TEXT: Record<FileDisplayStatus, string> = {
  stashed: '已暂存',
  manual_pending: '待整理',
  manual_ready: '可改名',
  parsing: '解析中',
  parsed: '已解析',
  renamed: '已改名',
  failed: '失败',
};
