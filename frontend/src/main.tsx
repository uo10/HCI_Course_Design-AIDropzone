import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (window.dropzone?.isElectron) {
  const root = document.documentElement;
  root.classList.add('electron-app');
  /** 首帧就标记小球模式，避免 body 灰底在 React 挂载前闪一下方框 */
  void window.dropzone.getShellMode().then(mode => {
    if (mode === 'ball') root.classList.add('electron-ball-mode');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
