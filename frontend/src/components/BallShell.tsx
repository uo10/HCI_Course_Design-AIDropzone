import { useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { filesFromDataTransferSync, resolvePathsForDroppedFiles } from '../utils/nativeDropFiles';

interface Props {
  onDropFiles: (files: File[]) => void;
}

const DRAG_THRESHOLD_PX = 6;
const DOUBLE_CLICK_MS = 450;

/**
 * 悬浮球：自由拖动；仅靠近屏幕边缘时贴边缩入；双击展开主面板。
 */
export function BallShell({ onDropFiles }: Props) {
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const lastClickAt = useRef(0);

  const endDrag = (
    e: { currentTarget: EventTarget & HTMLElement; pointerId: number; screenX: number; screenY: number },
    didMove: boolean,
  ) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (didMove) {
      window.dropzone?.finishBallDrag();
    }
  };

  return (
    <div
      className="ball-shell"
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer;
        if (!dt) return;
        const files = filesFromDataTransferSync(dt);
        if (!files.length) return;
        resolvePathsForDroppedFiles(files);
        onDropFiles(files);
        window.dropzone?.expandToPanel();
      }}
      onPointerEnter={() => {
        if (!dragging.current) window.dropzone?.expandBallDock();
      }}
      onPointerLeave={() => {
        if (!dragging.current) window.dropzone?.collapseBallDock();
      }}
      onPointerDown={e => {
        if (e.button !== 0) return;
        const b = window.dropzone?.getBallBoundsSync?.();
        if (!b) return;
        grabOffset.current = { x: e.screenX - b.x, y: e.screenY - b.y };
        dragStart.current = { x: e.screenX, y: e.screenY };
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (!dragging.current) return;
        window.dropzone?.moveBallTo(e.screenX - grabOffset.current.x, e.screenY - grabOffset.current.y);
      }}
      onPointerUp={e => {
        const dx = e.screenX - dragStart.current.x;
        const dy = e.screenY - dragStart.current.y;
        const didMove = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

        if (!didMove) {
          const now = Date.now();
          if (now - lastClickAt.current < DOUBLE_CLICK_MS) {
            lastClickAt.current = 0;
            window.dropzone?.expandToPanel();
          } else {
            lastClickAt.current = now;
          }
        }

        endDrag(e, didMove);
      }}
      onPointerCancel={e => {
        const dx = e.screenX - dragStart.current.x;
        const dy = e.screenY - dragStart.current.y;
        endDrag(e, Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX);
      }}
      onDoubleClick={e => {
        e.preventDefault();
        e.stopPropagation();
        window.dropzone?.expandToPanel();
      }}
    >
      <div className="ball-core" aria-hidden>
        <Sparkles className="ball-core-icon" strokeWidth={2} aria-hidden />
      </div>
    </div>
  );
}
