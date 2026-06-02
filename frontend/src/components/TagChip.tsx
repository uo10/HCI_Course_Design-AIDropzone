import { X } from 'lucide-react';

interface Props {
  label: string;
  onRemove?: () => void;
  variant?: 'default' | 'sensitive' | 'status-processed' | 'status-stashed';
}

const VARIANT_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'bg-blue-50 text-blue-700',
  sensitive: 'bg-red-50 text-red-600',
  'status-processed': 'bg-emerald-100 text-emerald-700',
  'status-stashed': 'bg-slate-100 text-slate-600',
};

export function TagChip({ label, onRemove, variant = 'default' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASS[variant]}`}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 opacity-70 hover:opacity-100"
          aria-label={`移除标签 ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
