export function canUseFileActions(): boolean {
  return Boolean(window.dropzone?.isElectron);
}

export function resolveActionPath(sourcePath: string | undefined | null): string | null {
  const trimmed = sourcePath?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function requireBridge() {
  if (!window.dropzone?.isElectron) {
    throw new Error('请在 Electron 桌面版中使用文件操作');
  }
  return window.dropzone;
}

export async function openFilePath(sourcePath: string): Promise<void> {
  const bridge = requireBridge();
  const path = resolveActionPath(sourcePath);
  if (!path) {
    throw new Error('无法获取文件路径');
  }
  const err = await bridge.openPath(path);
  if (err) {
    throw new Error(err);
  }
}

export async function revealFileInFolder(sourcePath: string): Promise<void> {
  const bridge = requireBridge();
  const path = resolveActionPath(sourcePath);
  if (!path) {
    throw new Error('无法获取文件路径');
  }
  await bridge.showItemInFolder(path);
}

export async function copyFileToClipboard(sourcePath: string): Promise<void> {
  const bridge = requireBridge();
  const path = resolveActionPath(sourcePath);
  if (!path) {
    throw new Error('无法获取文件路径');
  }
  await bridge.copyFilesToClipboard([path]);
}

export async function cutFileToClipboard(sourcePath: string): Promise<void> {
  const bridge = requireBridge();
  const path = resolveActionPath(sourcePath);
  if (!path) {
    throw new Error('无法获取文件路径');
  }
  await bridge.cutFilesToClipboard([path]);
}
