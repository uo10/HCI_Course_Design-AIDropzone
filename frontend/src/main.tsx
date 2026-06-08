import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (window.dropzone?.isElectron) {
  const root = document.documentElement;
  root.classList.add('electron-app');
  /** 同步读模式，避免 panel→ball 或首帧时 electron-ball-mode 晚于灰底 */
  const mode = window.dropzone.getShellModeSync();
  if (mode === 'ball') {
    root.classList.add('electron-ball-mode');
    root.classList.add('electron-ball-focused');
  }
  void window.dropzone.getShellMode().then(m => {
    if (m === 'ball') root.classList.add('electron-ball-mode');
    else root.classList.remove('electron-ball-mode', 'electron-ball-focused');
  });
  window.dropzone.onWindowFocused(focused => {
    if (focused) root.classList.add('electron-ball-focused');
    else root.classList.remove('electron-ball-focused');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
