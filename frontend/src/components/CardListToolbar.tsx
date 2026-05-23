import type { CardSortKey } from '../api/types';
import type { ProcessingMode } from './ProcessingModeSwitch';

interface CardListToolbarProps {
  allTags: string[];
  filterTag: string | null;
  onFilterTagChange: (tag: string | null) => void;
  filterSourceMode: ProcessingMode | 'all';
  onFilterSourceModeChange: (mode: ProcessingMode | 'all') => void;
  sortKey: CardSortKey;
  onSortKeyChange: (key: CardSortKey) => void;
  visibleCount: number;
  totalCount: number;
}

const SOURCE_MODE_OPTIONS: { value: ProcessingMode | 'all'; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'stash_only', label: '仅暂存' },
  { value: 'manual', label: '手动整理' },
  { value: 'ai_assisted', label: 'AI 辅助' },
];

const SORT_OPTIONS: { value: CardSortKey; label: string }[] = [
  { value: 'name', label: '文件名' },
  { value: 'status', label: '状态' },
  { value: 'tag', label: '标签' },
];

export function CardListToolbar({
  allTags,
  filterTag,
  onFilterTagChange,
  filterSourceMode,
  onFilterSourceModeChange,
  sortKey,
  onSortKeyChange,
  visibleCount,
  totalCount,
}: CardListToolbarProps) {
  return (
    <section className="card-toolbar" aria-label="文件列表筛选与排序">
      <p className="card-toolbar__count">
        显示 {visibleCount} / {totalCount} 项
      </p>
      <div className="card-toolbar__row">
        <label className="card-toolbar__field">
          <span className="card-toolbar__label">标签</span>
          <select
            className="card-toolbar__select"
            value={filterTag ?? ''}
            onChange={(e) =>
              onFilterTagChange(e.target.value === '' ? null : e.target.value)
            }
          >
            <option value="">全部标签</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label className="card-toolbar__field">
          <span className="card-toolbar__label">来源</span>
          <select
            className="card-toolbar__select"
            value={filterSourceMode}
            onChange={(e) =>
              onFilterSourceModeChange(e.target.value as ProcessingMode | 'all')
            }
          >
            {SOURCE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="card-toolbar__field">
          <span className="card-toolbar__label">排序</span>
          <select
            className="card-toolbar__select"
            value={sortKey}
            onChange={(e) => onSortKeyChange(e.target.value as CardSortKey)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
