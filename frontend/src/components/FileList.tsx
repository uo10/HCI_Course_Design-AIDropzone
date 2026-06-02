import { AnimatePresence } from 'framer-motion';
import type { FileItem } from '../types/fileItem';
import { FileListItem } from './FileListItem';

interface Props {
  files: FileItem[];
  selectedFileId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function FileList({ files, selectedFileId, onSelect, onRemove }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {files.map(file => (
          <FileListItem
            key={file.id}
            file={file}
            selected={file.id === selectedFileId}
            onSelect={() => onSelect(file.id)}
            onRemove={() => onRemove(file.id)}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
