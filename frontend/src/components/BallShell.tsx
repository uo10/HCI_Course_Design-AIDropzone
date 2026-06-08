import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useBallParseFeedback } from '../hooks/useBallParseFeedback';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { FileItem } from '../types/fileItem';
import { filesFromDataTransferSync, resolvePathsForDroppedFiles } from '../utils/nativeDropFiles';

interface Props {
  files: FileItem[];
  onDropFiles: (files: File[]) => string[];
}

const DRAG_THRESHOLD_PX = 6;
const DOUBLE_CLICK_MS = 450;

type BallUiPhase = 'idle' | 'armed' | 'swallow' | 'processing' | 'success';

function setCapsuleChrome(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('ball-root--capsule');
    window.dropzone?.setBallVisualPreset('capsule');
  } else {
    root.classList.remove('ball-root--capsule');
    window.dropzone?.setBallVisualPreset('idle');
  }
}

/**
 * 悬浮球：胶囊 morph、非模态拖入、解析反馈；双击展开主面板。
 */
export function BallShell({ files, onDropFiles }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const dragging = useRef(false);
  const dragDepth = useRef(0);
  const grabOffset = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const lastClickAt = useRef(0);
  const swallowTimer = useRef<number | null>(null);

  const [uiPhase, setUiPhase] = useState<BallUiPhase>('idle');
  const [batchIds, setBatchIds] = useState<string[] | null>(null);

  const parsePhase = useBallParseFeedback(files, batchIds);

  const showCapsule =
    uiPhase === 'armed' ||
    uiPhase === 'swallow' ||
    uiPhase === 'processing' ||
    uiPhase === 'success' ||
    parsePhase === 'processing' ||
    parsePhase === 'success';

  useEffect(() => {
    setCapsuleChrome(showCapsule);
    return () => {
      document.documentElement.classList.remove('ball-root--capsule');
      window.dropzone?.setBallVisualPreset('idle');
    };
  }, [showCapsule]);

  useEffect(() => {
    if (parsePhase === 'processing') {
      setUiPhase('processing');
    } else if (parsePhase === 'success') {
      setUiPhase('success');
    } else if (parsePhase === 'idle') {
      setUiPhase(prev => {
        if (prev === 'success' || prev === 'processing') return 'idle';
        return prev;
      });
      setBatchIds(null);
    }
  }, [parsePhase]);

  const enterArmed = useCallback(() => {
    if (dragging.current) return;
    setUiPhase('armed');
  }, []);

  const exitToIdle = useCallback(() => {
    if (uiPhase === 'processing' || uiPhase === 'success' || uiPhase === 'swallow') return;
    dragDepth.current = 0;
    setUiPhase('idle');
  }, [uiPhase]);

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

  const morphTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 28 };

  return (
    <div
      className="ball-shell"
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current += 1;
        if (dragDepth.current === 1) enterArmed();
      }}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={e => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) exitToIdle();
      }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        dragDepth.current = 0;
        const dt = e.dataTransfer;
        if (!dt) return;
        const dropped = filesFromDataTransferSync(dt);
        if (!dropped.length) return;
        resolvePathsForDroppedFiles(dropped);
        setUiPhase('swallow');
        if (swallowTimer.current != null) window.clearTimeout(swallowTimer.current);
        const ids = onDropFiles(dropped);
        setBatchIds(ids.length > 0 ? ids : null);
        swallowTimer.current = window.setTimeout(() => {
          swallowTimer.current = null;
          setUiPhase(ids.length > 0 ? 'processing' : 'idle');
        }, reducedMotion ? 0 : 200);
      }}
      onPointerEnter={() => {
        if (!dragging.current && uiPhase === 'idle') window.dropzone?.expandBallDock();
      }}
      onPointerLeave={() => {
        if (!dragging.current && uiPhase === 'idle') window.dropzone?.collapseBallDock();
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
      <motion.div
        className={`ball-morph ${showCapsule ? 'ball-morph--capsule' : 'ball-morph--idle'}`}
        layout
        transition={morphTransition}
        animate={{
          scale: uiPhase === 'swallow' ? 0.92 : 1,
        }}
      >
        <div className="ball-glass">
          {uiPhase === 'armed' && (
            <div className="ball-armed-ring" aria-hidden>
              <span className="ball-armed-label">松手投放</span>
            </div>
          )}

          <div className="ball-core-wrap" aria-live="polite">
            {(uiPhase === 'processing' || parsePhase === 'processing') && (
              <div className="ball-orbit-ring ball-orbit-ring--processing" aria-hidden />
            )}
            {uiPhase === 'success' && (
              <div className="ball-orbit-ring ball-orbit-ring--success" aria-hidden />
            )}
            <div className="ball-core">
              <Sparkles className="ball-core-icon" strokeWidth={2} aria-hidden />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
