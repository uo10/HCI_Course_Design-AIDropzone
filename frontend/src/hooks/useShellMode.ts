import { useEffect, useState } from 'react';
import type { ShellMode } from '../types/electron';

export function useShellMode(): ShellMode {
  const [mode, setMode] = useState<ShellMode>('panel');

  useEffect(() => {
    const bridge = window.dropzone;
    if (!bridge?.getShellMode) {
      document.body.classList.remove('app-electron', 'shell-ball', 'shell-panel');
      queueMicrotask(() => setMode('panel'));
      return;
    }

    document.body.classList.add('app-electron');

    const applyBodyClass = (m: ShellMode) => {
      document.body.classList.toggle('shell-ball', m === 'ball');
      document.body.classList.toggle('shell-panel', m === 'panel');
      setMode(m);
    };

    void bridge.getShellMode().then(applyBodyClass);
    const unsubscribe = bridge.onShellModeChanged(applyBodyClass);
    return () => {
      unsubscribe();
      document.body.classList.remove('app-electron', 'shell-ball', 'shell-panel');
    };
  }, []);

  return mode;
}
