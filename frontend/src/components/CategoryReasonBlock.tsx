import { parseCategoryReason } from '../utils/formatCategoryReason';

interface Props {
  summary: string;
  lastExtraPrompt?: string;
}

export function CategoryReasonBlock({ summary, lastExtraPrompt }: Props) {
  const lines = parseCategoryReason(summary, lastExtraPrompt);

  if (lines.length === 0) {
    return <p className="mt-0.5 text-xs text-slate-400">暂无说明</p>;
  }

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
