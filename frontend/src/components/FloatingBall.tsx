import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileMetadata } from '../api/types';

interface FloatingBallProps {
  onFilesDropped: (files: FileMetadata[]) => void;
  onDropError?: (message: string) => void;
}

const COLLAPSE_DELAY_MS = 450;

export function FloatingBall({ onFilesDropped, onDropError }: FloatingBallProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = setTimeout(() => {
      window.dropzone?.collapseBallDock();
    }, COLLAPSE_DELAY_MS);
  }, [clearCollapseTimer]);

  const handleMouseEnter = useCallback(() => {
    clearCollapseTimer();
    window.dropzone?.expandBallDock();
  }, [clearCollapseTimer]);

  const handleMouseLeave = useCallback(() => {
    if (!dragRef.current) {
      scheduleCollapse();
    }
  }, [scheduleCollapse]);

  const handleExpandPanel = useCallback(() => {
    clearCollapseTimer();
    window.dropzone?.expandToPanel();
  }, [clearCollapseTimer]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.screenX, y: e.screenY, moved: false };
    window.dropzone?.expandBallDock();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !(e.buttons & 1)) return;
    const dx = e.screenX - dragRef.current.x;
    const dy = e.screenY - dragRef.current.y;
    if (dx * dx + dy * dy > 16) {
      dragRef.current.moved = true;
      window.dropzone?.dragBallBy(dx, dy);
      dragRef.current.x = e.screenX;
      dragRef.current.y = e.screenY;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (drag && !drag.moved) {
        handleExpandPanel();
      } else {
        window.dropzone?.snapBallDock();
      }
      scheduleCollapse();
    },
    [handleExpandPanel, scheduleCollapse],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    clearCollapseTimer();
    window.dropzone?.expandBallDock();
  }, [clearCollapseTimer]);

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

      const bridge = window.dropzone;
      if (!bridge) return;

      const paths: string[] = [];
      for (const file of Array.from(e.dataTransfer.files)) {
        try {
          paths.push(bridge.getPathForFile(file));
        } catch {
          // skip
        }
      }

      if (paths.length === 0) return;

      try {
        const metadata = await bridge.getFileMetadataBatch(paths);
        bridge.expandToPanel();
        onFilesDropped(metadata);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : '无法读取拖入的文件。';
        onDropError?.(msg);
      }
    },
    [onFilesDropped, onDropError],
  );

  useEffect(() => () => clearCollapseTimer(), [clearCollapseTimer]);

  return (
    <div
      className={`floating-ball ${isDragOver ? 'floating-ball--active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => void handleDrop(e)}
    >
      <div
        className="floating-ball__orb"
        role="presentation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
