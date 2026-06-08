import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** 文件剪贴板需 WinForms，用 Windows PowerShell 5.1 更稳定 */
const WINDOWS_POWERSHELL =
  process.platform === 'win32' && process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';

async function assertFilesExist(paths: string[]): Promise<void> {
  for (const filePath of paths) {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new Error(`路径不是文件：${filePath}`);
    }
  }
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function runPowerShellScript(script: string): Promise<void> {
  const scriptPath = path.join(
    os.tmpdir(),
    `aidropzone-ps-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`,
  );
  await fs.writeFile(scriptPath, `\uFEFF${script}`, 'utf8');
  try {
    await execFileAsync(
      WINDOWS_POWERSHELL,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', scriptPath],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
  } catch (err: unknown) {
    const e = err as { stderr?: string | Buffer; message?: string };
    const stderr =
      typeof e.stderr === 'string'
        ? e.stderr
        : e.stderr instanceof Buffer
          ? e.stderr.toString('utf8')
          : '';
    const detail = (stderr || e.message || String(err)).trim();
    const firstLine = detail.split(/\r?\n/).find(line => line.trim().length > 0) ?? detail;
    throw new Error(firstLine || 'PowerShell 执行失败');
  } finally {
    await fs.unlink(scriptPath).catch(() => {});
  }
}

function buildPathListScript(paths: string[]): string {
  return paths.map(p => `  ${psQuote(path.normalize(p))}`).join(',\n');
}

async function windowsCopyFiles(paths: string[]): Promise<void> {
  const script = `
$ErrorActionPreference = 'Stop'
Set-Clipboard -Path @(
${buildPathListScript(paths)}
)
`.trim();
  await runPowerShellScript(script);
}

async function windowsCutFiles(paths: string[]): Promise<void> {
  const addLines = paths.map(p => `$col.Add(${psQuote(path.normalize(p))})`).join('\n');
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$col = New-Object System.Collections.Specialized.StringCollection
${addLines}
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($col)
$stream = New-Object System.IO.MemoryStream (,[byte[]](2,0,0,0))
$data.SetData('Preferred DropEffect', $stream)
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`.trim();
  await runPowerShellScript(script);
}

async function darwinSetClipboardFiles(paths: string[]): Promise<void> {
  const items = paths
    .map(p => `(POSIX file ${JSON.stringify(p)})`)
    .join(', ');
  await execFileAsync('osascript', ['-e', `set the clipboard to {${items}}`]);
}

export async function copyFilesToClipboard(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    throw new Error('没有可复制的文件');
  }
  await assertFilesExist(paths);

  if (process.platform === 'win32') {
    await windowsCopyFiles(paths);
    return;
  }
  if (process.platform === 'darwin') {
    await darwinSetClipboardFiles(paths);
    return;
  }
  throw new Error('当前系统暂不支持复制文件到剪贴板');
}

export async function cutFilesToClipboard(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    throw new Error('没有可剪切的文件');
  }
  await assertFilesExist(paths);

  if (process.platform === 'win32') {
    await windowsCutFiles(paths);
    return;
  }
  if (process.platform === 'darwin') {
    throw new Error('macOS 暂不支持剪切文件，请使用复制');
  }
  throw new Error('当前系统暂不支持剪切文件到剪贴板');
}
