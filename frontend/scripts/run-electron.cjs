/**
 * 启动 Electron 开发窗口；父进程会等待 Electron 退出（避免 concurrently -k 误杀 Vite）。
 *
 *   node scripts/run-electron.cjs          → 默认悬浮球
 *   node scripts/run-electron.cjs --panel  → 直接大面板
 */
const { spawn } = require('child_process');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const usePanel =
  process.argv.includes('--panel') || process.env.DROPZONE_START_PANEL === '1';

const env = { ...process.env };
if (usePanel) {
  env.DROPZONE_START_PANEL = '1';
}

/** require('electron') 返回可执行文件路径，跨平台且父进程会正确等待 */
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], {
  cwd: frontendRoot,
  stdio: 'inherit',
  env,
});

child.on('error', (err) => {
  console.error('[run-electron] 无法启动 Electron:', err.message);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`[run-electron] Electron 被信号终止: ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
