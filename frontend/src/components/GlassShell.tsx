import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { History, Minus, Package, Pin, Settings, X } from 'lucide-react';

export type AppView = 'home' | 'activityLog' | 'settings' | 'export';

interface Props {
  children: ReactNode;
  wide?: boolean;
  view: AppView;
  logCount?: number;
  onOpenActivityLog?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
}

export function GlassShell({
  children,
  wide,
  view,
  logCount = 0,
  onOpenActivityLog,
  onOpenExport,
  onOpenSettings,
}: Props) {
  const isHome = view === 'home';

  function handleClose() {
    window.dropzone?.closeWindow();
  }

  const isElectron = Boolean(window.dropzone?.isElectron);

  const page = (
    <div
      className={`glass-page relative flex w-full overflow-hidden ${
        isElectron ? 'h-full min-h-0' : 'min-h-screen items-center justify-center p-4 md:p-8'
      }`}
    >
      <div className="glass-page-blob glass-page-blob-a" aria-hidden />
      <div className="glass-page-blob glass-page-blob-b" aria-hidden />
      <div className="glass-page-blob glass-page-blob-c" aria-hidden />

      <motion.div
        layout
        className={`glass-panel relative z-10 flex w-full flex-col overflow-hidden ${
          isElectron ? 'h-full max-h-none' : `max-h-[90vh] ${wide ? 'max-w-4xl' : 'max-w-lg'}`
        }`}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <header className="glass-panel-header flex shrink-0 items-center gap-3 px-5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#0078d4] to-[#5b5bd6] text-xs font-semibold text-white shadow-sm ring-1 ring-white/40">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-800">AI 文件整理助手</h1>
            <p className="text-[11px] text-slate-500/90">智能识别 · 自动命名 · 高效归档</p>
          </div>
          {isHome && (
            <div className="flex shrink-0 items-center gap-0.5 text-slate-400">
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-black/[0.04] hover:text-slate-700"
                aria-label="置顶"
                title="置顶（即将支持）"
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-black/[0.04] hover:text-slate-700"
                aria-label="最小化"
                title="最小化（折叠到悬浮球）"
                onClick={() => {
                  document.documentElement.classList.add('electron-ball-mode');
                  document.documentElement.classList.remove('electron-ball-focused');
                  window.dropzone?.collapseToBall();
                }}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md p-1.5 hover:bg-red-500/10 hover:text-red-600"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        <div className="glass-panel-body flex min-h-0 flex-1 flex-col">{children}</div>

        {isHome && onOpenActivityLog && onOpenExport && onOpenSettings && (
          <footer className="glass-panel-footer flex shrink-0 items-center justify-end gap-1.5 px-3 py-2">
            <button
              type="button"
              onClick={onOpenExport}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/55 hover:text-slate-800"
              title="搜索 workspace 文件并打包 zip"
            >
              <Package className="h-3.5 w-3.5" />
              搜索与打包
            </button>
            <button
              type="button"
              onClick={onOpenActivityLog}
              className="relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/55 hover:text-blue-600"
              title="操作日志与回滚"
            >
              <History className="h-3.5 w-3.5" />
              日志
              {logCount > 0 && (
                <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                  {logCount > 99 ? '99+' : logCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/55 hover:text-slate-800"
              title="设置"
            >
              <Settings className="h-3.5 w-3.5" />
              设置
            </button>
          </footer>
        )}
      </motion.div>
    </div>
  );

  if (isElectron) {
    return <div className="electron-panel-shell flex min-h-0 flex-1">{page}</div>;
  }
  return page;
}
