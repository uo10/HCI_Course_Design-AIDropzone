import { useState } from 'react';
import type { TagSearchFileItem } from '../api/types';
import { FileIconActions } from './FileIconActions';
import { TagChip } from './TagChip';

function extFromName(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  file: TagSearchFileItem;
  checked: boolean;
  onToggle: () => void;
}

export function SearchResultFileRow({ file, checked, onToggle }: Props) {
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="electron-no-drag flex items-center gap-3 rounded-xl border border-white/55 bg-white/55 px-3 py-2.5 shadow-sm backdrop-blur-sm hover:bg-white/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
      />
      <FileIconActions
        sourcePath={file.path}
        extension={extFromName(file.name)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/80 text-blue-600"
        iconClassName="h-4 w-4"
        onActionError={setActionError}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
          <span className="text-[10px] text-slate-400">{formatBytes(file.size_bytes)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {file.tags
            .filter(t => t !== 'sensitive')
            .slice(0, 4)
            .map(tag => (
              <TagChip key={tag} label={tag} />
            ))}
        </div>
        {actionError && (
          <p className="mt-0.5 truncate text-[10px] text-amber-600">{actionError}</p>
        )}
      </div>
    </div>
  );
}
