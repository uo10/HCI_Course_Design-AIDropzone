import { motion } from 'framer-motion';

interface Props {
  label?: string;
  className?: string;
}

export function ThinkingPlaceholder({
  label = 'AI 正在思考…',
  className = '',
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-emerald-500/70"
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
