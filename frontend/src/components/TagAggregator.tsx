interface TagGroup {
  tag: string;
  count: number;
}

interface TagAggregatorProps {
  groups: TagGroup[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagAggregator({ groups, activeTag, onSelectTag }: TagAggregatorProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="tag-aggregator" aria-label="标签聚合">
      <h3 className="tag-aggregator__title">标签</h3>
      <ul className="tag-aggregator__list">
        <li>
          <button
            type="button"
            className={`tag-aggregator__chip ${activeTag === null ? 'tag-aggregator__chip--active' : ''}`}
            onClick={() => onSelectTag(null)}
          >
            全部
          </button>
        </li>
        {groups.map(({ tag, count }) => (
          <li key={tag}>
            <button
              type="button"
              className={`tag-aggregator__chip ${activeTag === tag ? 'tag-aggregator__chip--active' : ''}`}
              onClick={() => onSelectTag(tag)}
            >
              {tag}
              <span className="tag-aggregator__count">{count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
