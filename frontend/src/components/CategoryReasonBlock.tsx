import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { FileCategory } from '../api/types';
import { parseCategoryReason } from '../utils/formatCategoryReason';
import { ThinkingPlaceholder } from './ThinkingPlaceholder';

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const lineVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22 } },
};

interface Props {
  summary: string;
  lastExtraPrompt?: string;
  /** config 常驻风格；LLM 响应 summary 里通常不含「风格要求:」 */
  persistentStylePrompt?: string;
  parseCategory?: FileCategory;
  fileSizeBytes?: number;
  extension?: string;
  /** 为 true 时逐行淡入；false 时静态展示 */
  animateReveal?: boolean;
  /** 变化时重新播放淡入 */
  revealKey?: string;
  /** 等待 AI 结果时的占位 */
  waiting?: boolean;
}

export function CategoryReasonBlock({
  summary,
  lastExtraPrompt,
  persistentStylePrompt,
  parseCategory,
  fileSizeBytes,
  extension,
  animateReveal = false,
  revealKey = '',
  waiting = false,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const lines = parseCategoryReason(summary, lastExtraPrompt, persistentStylePrompt, {
    parseCategory,
    fileSizeBytes,
    extension,
  });
  const shouldAnimate = animateReveal && !reducedMotion && !waiting && lines.length > 0;

  if (waiting) {
    return (
      <div className="mt-1.5 space-y-2">
        <ThinkingPlaceholder label="AI 正在分析…" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-emerald-100/80" />
          <div className="h-3 w-[80%] animate-pulse rounded bg-emerald-100/60" />
          <div className="h-3 w-[60%] animate-pulse rounded bg-emerald-100/40" />
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return <p className="mt-0.5 text-xs text-slate-400">暂无说明</p>;
  }

  if (!shouldAnimate) {
    return (
      <div className="mt-1.5 space-y-2">
        {lines.map((line, i) => (
          <div key={`${line.kind}-${i}`} className="text-xs leading-relaxed text-slate-600">
            {line.label ? (
              <>
                <span className="font-semibold text-slate-500">{line.label}：</span>
                <span>{line.text}</span>
              </>
            ) : (
              <span>{line.text}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      key={revealKey}
      className="mt-1.5 space-y-2"
      variants={listVariants}
      initial="hidden"
      animate="show"
    >
      {lines.map((line, i) => (
        <motion.div
          key={`${line.kind}-${i}`}
          variants={lineVariants}
          className="text-xs leading-relaxed text-slate-600"
        >
          {line.label ? (
            <>
              <span className="font-semibold text-slate-500">{line.label}：</span>
              <span>{line.text}</span>
            </>
          ) : (
            <span>{line.text}</span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
