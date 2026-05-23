export type ProcessingMode = 'stash_only' | 'manual' | 'ai_assisted';

interface ProcessingModeSwitchProps {
  mode: ProcessingMode;
  onChange: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

const MODES: { id: ProcessingMode; label: string }[] = [
  { id: 'stash_only', label: '仅暂存' },
  { id: 'manual', label: '手动' },
  { id: 'ai_assisted', label: 'AI' },
];

const HINTS: Record<ProcessingMode, string> = {
  stash_only: '不调用 AI，只保留文件信息',
  manual: '自行填写标签与文件名',
  ai_assisted: '自动解析并给出建议',
};

export function ProcessingModeSwitch({
  mode,
  onChange,
  disabled = false,
}: ProcessingModeSwitchProps) {
  return (
    <fieldset className="mode-switch" disabled={disabled}>
      <legend className="mode-switch__legend">处理模式</legend>
      <div className="mode-switch__segmented" role="group" aria-label="处理模式">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-switch__segment ${mode === m.id ? 'mode-switch__segment--active' : ''}`}
            onClick={() => onChange(m.id)}
            disabled={disabled}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mode-switch__hint">{HINTS[mode]}</p>
    </fieldset>
  );
}
