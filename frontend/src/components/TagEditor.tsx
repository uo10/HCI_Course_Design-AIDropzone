import { useState } from 'react';
import { normalizeTag, validateTag } from '../utils/tagValidation';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagEditor({ tags, onChange, disabled = false }: TagEditorProps) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const addTag = () => {
    const normalized = normalizeTag(input);
    if (!normalized) return;

    const err = validateTag(normalized);
    if (err) {
      setInputError(err);
      return;
    }
    if (tags.includes(normalized)) {
      setInputError('该标签已存在');
      return;
    }

    onChange([...tags, normalized]);
    setInput('');
    setInputError(null);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="tag-editor">
      <span className="tag-editor__label">标签</span>
      <div className="tag-editor__tags">
        {tags.map((tag) => (
          <span key={tag} className="tag-editor__chip">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tag-editor__remove"
                onClick={() => removeTag(tag)}
                aria-label={`移除标签 ${tag}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && (
          <span className="tag-editor__empty">暂无标签，可手动添加</span>
        )}
      </div>
      {!disabled && (
        <div className="tag-editor__add">
          <input
            type="text"
            className="tag-editor__input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="小写字母、数字、下划线"
          />
          <button type="button" className="tag-editor__add-btn" onClick={addTag}>
            添加
          </button>
        </div>
      )}
      {inputError && <p className="tag-editor__error">{inputError}</p>}
    </div>
  );
}
