import { isMockMode, getApiBase } from '../services/dropzoneApi';

function isElectron(): boolean {
  return Boolean(window.dropzone?.isElectron);
}

export function ApiModeBanner() {
  const mock = isMockMode();
  const electron = isElectron();

  if (mock) {
    return (
      <div className="electron-no-drag mx-3 mt-2 shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-3 py-1.5 text-[11px] leading-relaxed text-amber-900">
        <strong>Mock 模式</strong>：改名<strong>不会</strong>动桌面上的真实文件，只改界面。
        要到「设置」关闭 Mock 并刷新；桌面文件必须用{' '}
        <code className="rounded bg-white/60 px-1">npm run electron:dev:full</code> 启动。
      </div>
    );
  }

  if (!electron) {
    return (
      <div className="electron-no-drag mx-3 mt-2 shrink-0 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-1.5 text-[11px] leading-relaxed text-red-800">
        <strong>联调模式</strong>（{getApiBase()}），但当前是<strong>纯浏览器</strong>，拿不到
        C:\Users\...\Desktop 路径，无法改名。请关闭本标签页，改用{' '}
        <code className="rounded bg-white/60 px-1">npm run electron:dev:full</code>。
      </div>
    );
  }

  return (
    <div className="electron-no-drag mx-3 mt-2 shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1.5 text-[11px] leading-relaxed text-emerald-900">
      <strong>可改磁盘文件</strong>：Electron + 后端 {getApiBase()}。整理篮 workspace 仅影响
      <strong>打包导出</strong>，不限制桌面路径改名。
    </div>
  );
}
