import { useCallback, useState } from 'react';
import type { FileMetadata } from '../api/types';

interface DropzoneProps {
  onSimulateDrop: () => void;
  onFilesDropped: (files: FileMetadata[]) => void;
  onDropError?: (message: string) => void;
  disabled?: boolean;
}

const isElectron = Boolean(window.dropzone?.isElectron);

export function Dropzone({
  onSimulateDrop,
  onFilesDropped,
  onDropError,
  disabled = false,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const bridge = window.dropzone;
      if (!bridge?.isElectron) return;

      const fileList = Array.from(e.dataTransfer.files);
      if (fileList.length === 0) {
        onDropError?.('未检测到文件，请从资源管理器拖入文件。');
        return;
      }

      try {
        const paths: string[] = [];
        for (const file of fileList) {
          const filePath = bridge.getPathForFile(file);
          if (!filePath) {
            onDropError?.('无法获取文件路径，请重试或改用手动整理。');
            return;
          }
          paths.push(filePath);
        }

        const metadata =
          paths.length === 1
            ? [await bridge.getFileMetadata(paths[0])]
            : await bridge.getFileMetadataBatch(paths);

        onFilesDropped(metadata);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : '拖入文件失败，请检查权限后重试。';
        onDropError?.(message);
      }
    },
    [disabled, onDropError, onFilesDropped],
  );

  return (
    <section
      className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
      aria-label="文件拖入区"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => void handleDrop(e)}
    >
      <p className="dropzone__hint">
        {isElectron
          ? '将文件拖到此处'
          : '将文件拖到此处（Electron 阶段启用）'}
      </p>
      {!isElectron && (
        <button
          type="button"
          className="dropzone__button"
          onClick={onSimulateDrop}
          disabled={disabled}
        >
          模拟拖入文件
        </button>
      )}
    </section>
  );
}
