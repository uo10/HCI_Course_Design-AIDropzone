import { useEffect, useState } from 'react';
import type { FileItem } from '../types/fileItem';

export type BallFeedbackPhase = 'idle' | 'processing' | 'success';

/**
 * 跟踪最近一次从悬浮球投放入队的文件，驱动 processing → success → idle。
 */
export function useBallParseFeedback(
  files: FileItem[],
  batchIds: string[] | null,
): BallFeedbackPhase {
  const [phase, setPhase] = useState<BallFeedbackPhase>('idle');

  useEffect(() => {
    if (!batchIds?.length) {
      setPhase('idle');
      return;
    }
    const batch = files.filter(f => batchIds.includes(f.id));
    if (batch.length === 0) return;

    if (batch.some(f => f.status === 'parsing')) {
      setPhase('processing');
      return;
    }

    const allDone = batch.every(f => f.status === 'processed' || f.status === 'error');
    if (allDone) {
      setPhase(prev => {
        if (prev === 'processing' || prev === 'success') return 'success';
        return prev;
      });
    }
  }, [files, batchIds]);

  useEffect(() => {
    if (phase !== 'success') return;
    const t = window.setTimeout(() => setPhase('idle'), 700);
    return () => window.clearTimeout(t);
  }, [phase]);

  return phase;
}
