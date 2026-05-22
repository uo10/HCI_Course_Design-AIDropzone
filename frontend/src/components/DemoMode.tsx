interface DemoModeProps {
  onLoadDemo: () => void;
  disabled?: boolean;
}

export function DemoMode({ onLoadDemo, disabled = false }: DemoModeProps) {
  return (
    <section className="demo-mode">
      <p className="demo-mode__hint">
        答辩演示：一键加载示例文件，无需拖入或启动后端。
      </p>
      <button
        type="button"
        className="demo-mode__button"
        onClick={onLoadDemo}
        disabled={disabled}
      >
        加载演示数据
      </button>
    </section>
  );
}
