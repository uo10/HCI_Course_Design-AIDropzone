import type { FileCardViewModel } from '../api/types';
import { deriveDisplayStatus, DISPLAY_STATUS_TEXT } from '../utils/displayStatus';
import { TagEditor } from './TagEditor';

interface FileCardProps {
  card: FileCardViewModel;
  expanded: boolean;
  onToggleExpand: () => void;
  editable?: boolean;
  onTagsChange?: (tags: string[]) => void;
  onSuggestedNameChange?: (name: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({
  card,
  expanded,
  onToggleExpand,
  editable = false,
  onTagsChange,
  onSuggestedNameChange,
}: FileCardProps) {
  const {
    metadata,
    status,
    suggested_name,
    tags,
    summary,
    category,
    confidence,
    error,
  } = card;
  const display_status = card.display_status ?? deriveDisplayStatus(card);

  const canEdit =
    editable &&
    status === 'complete' &&
    display_status !== 'renamed' &&
    display_status !== 'failed';

  const primaryTag = tags[0];
  const isSensitive = tags.includes('sensitive');

  const sourceClass = card.source_mode
    ? `file-card--source-${card.source_mode}`
    : '';

  return (
    <article
      className={`file-card ${sourceClass} ${isSensitive ? 'file-card--sensitive' : ''} ${expanded ? 'file-card--expanded' : ''}`}
    >
      <button
        type="button"
        className="file-card__compact"
        onClick={onToggleExpand}
        aria-expanded={expanded}
      >
        <span
          className={`file-card__chevron ${expanded ? 'file-card__chevron--open' : ''}`}
          aria-hidden
        >
          ▶
        </span>
        <span className={`file-card__status file-card__status--${display_status}`}>
          {DISPLAY_STATUS_TEXT[display_status]}
        </span>
        <span className="file-card__compact-name">{metadata.name_before_drop}</span>
        {primaryTag && !expanded && (
          <span className="file-card__compact-tag">{primaryTag}</span>
        )}
      </button>

      {expanded && (
        <div className="file-card__details">
          {isSensitive && (
            <p className="file-card__sensitive-warn" role="alert">
              疑似敏感文件（如简历/合同等），请确认后再改名或导出。
            </p>
          )}
          <p className="file-card__row">
            <span className="file-card__label">大小</span>
            {formatSize(metadata.size_bytes)} · {metadata.extension}
            {category ? ` · ${category}` : ''}
          </p>

          <p className="file-card__row file-card__path" title={metadata.path}>
            <span className="file-card__label">路径</span>
            {metadata.path}
          </p>

          {status === 'failure' && error && (
            <p className="file-card__error">{error}</p>
          )}

          {canEdit && onSuggestedNameChange ? (
            <label className="file-card__field">
              <span className="file-card__label">目标文件名</span>
              <input
                type="text"
                className="file-card__input"
                value={suggested_name ?? ''}
                onChange={(e) => onSuggestedNameChange(e.target.value)}
              />
            </label>
          ) : (
            suggested_name && (
              <p className="file-card__row file-card__suggested">
                <span className="file-card__label">建议名</span>
                {suggested_name}
              </p>
            )
          )}

          {canEdit && onTagsChange ? (
            <TagEditor tags={tags} onChange={onTagsChange} />
          ) : (
            tags.length > 0 && (
              <div className="file-card__tags">
                {tags.map((tag) => (
                  <span key={tag} className="file-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )
          )}

          {summary && (
            <p className="file-card__summary">
              {summary}
              {confidence !== undefined &&
                `（置信度 ${Math.round(confidence * 100)}%）`}
            </p>
          )}

          {status === 'parsing' && (
            <p className="file-card__hint">正在解析…</p>
          )}
        </div>
      )}
    </article>
  );
}
