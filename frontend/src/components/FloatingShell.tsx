import type { ReactNode } from 'react';

interface FloatingShellProps {
  children: ReactNode;
}

const isElectron = Boolean(window.dropzone?.isElectron);

export function FloatingShell({ children }: FloatingShellProps) {
  return (
    <div className="floating-shell">
      <header className="floating-shell__titlebar">
        <span className="floating-shell__title">AI Dropzone</span>
        {isElectron && (
          <div className="floating-shell__controls no-drag">
            <button
              type="button"
              className="floating-shell__btn floating-shell__btn--collapse"
              onClick={() => window.dropzone?.collapseToBall()}
              aria-label="收起到悬浮球"
              title="收起到悬浮球"
            >
              ◢
            </button>
            <button
              type="button"
              className="floating-shell__btn floating-shell__btn--close"
              onClick={() => window.dropzone?.closeWindow()}
              aria-label="关闭"
              title="关闭"
            >
              ×
            </button>
          </div>
        )}
      </header>
      <div className="floating-shell__body scroll-themed">{children}</div>
    </div>
  );
}
