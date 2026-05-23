import type { RenamedEntry } from '../api/types';

interface RenamePreviewListProps {
  entries: RenamedEntry[];
  dryRun?: boolean;
}

export function RenamePreviewList({ entries, dryRun = true }: RenamePreviewListProps) {
  if (entries.length === 0) {
    return (
      <section className="rename-preview">
        <h3 className="rename-preview__title">改名预览</h3>
        <p className="rename-preview__empty">没有可预览的改名项</p>
      </section>
    );
  }

  return (
    <section className="rename-preview">
      <h3 className="rename-preview__title">
        {dryRun ? '改名预览（未写入磁盘）' : '已确认改名'}
      </h3>
      <ul className="rename-preview__list">
        {entries.map((entry) => (
          <li key={entry.old} className="rename-preview__item">
            <p className="rename-preview__path">
              <span className="rename-preview__label">原路径</span>
              <code>{entry.old}</code>
            </p>
            <p className="rename-preview__path rename-preview__path--new">
              <span className="rename-preview__label">新路径</span>
              <code>{entry.new}</code>
            </p>
            {entry.tags.length > 0 && (
              <p className="rename-preview__tags">
                标签：{entry.tags.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
