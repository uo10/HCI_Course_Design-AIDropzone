interface PrivacyToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function PrivacyToggle({ enabled, onChange, disabled = false }: PrivacyToggleProps) {
  return (
    <section className="privacy-toggle">
      <label className="privacy-toggle__label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>隐私模式</span>
      </label>
      <p className="privacy-toggle__hint">
        开启后仅使用本地 Mock 解析，不上传文件内容；只发送文件名与类型信息。
      </p>
    </section>
  );
}
