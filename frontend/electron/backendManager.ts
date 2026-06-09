import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import treeKill from 'tree-kill';

export const BUNDLED_BACKEND_PORT = 17823;
export const BUNDLED_API_BASE = `http://127.0.0.1:${BUNDLED_BACKEND_PORT}`;

let backendProcess: ChildProcess | null = null;
let backendPid: number | null = null;

export function getUserConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

/** Strip secrets from a freshly copied user config (installers must never ship keys). */
function sanitizeUserConfigFile(configPath: string): void {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    raw.workspace_root = '';
    raw.naming_style_prompt = '';
    const opts = raw.ai_parser_options as Record<string, unknown> | undefined;
    const llm = opts?.llm as Record<string, unknown> | undefined;
    if (llm) {
      llm.api_key = '';
    }
    fs.writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  } catch {
    fs.writeFileSync(configPath, '{}\n', 'utf8');
  }
}

/** Copy bundled config template into %APPDATA% on first launch. */
export function ensureUserConfig(): string {
  const configPath = getUserConfigPath();
  if (fs.existsSync(configPath)) {
    return configPath;
  }

  const templateCandidates = [
    path.join(process.resourcesPath, 'backend', 'config.example.json'),
    path.join(process.resourcesPath, 'backend', 'backend', 'config.example.json'),
  ];

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const template = templateCandidates.find(candidate => fs.existsSync(candidate));
  if (template) {
    fs.copyFileSync(template, configPath);
    sanitizeUserConfigFile(configPath);
  } else {
    fs.writeFileSync(configPath, '{}\n', 'utf8');
  }

  return configPath;
}

export function getBackendExePath(): string {
  return path.join(process.resourcesPath, 'backend', 'aidropzone-server.exe');
}

async function waitForBackendReady(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `${BUNDLED_API_BASE}/docs`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`后端未在 ${timeoutMs / 1000}s 内就绪（${BUNDLED_API_BASE}）`);
}

export async function startBundledBackend(): Promise<void> {
  const exePath = getBackendExePath();
  if (!fs.existsSync(exePath)) {
    throw new Error(`找不到后端可执行文件：${exePath}`);
  }

  const configPath = ensureUserConfig();
  const exeDir = path.dirname(exePath);

  backendProcess = spawn(exePath, [], {
    cwd: exeDir,
    env: {
      ...process.env,
      AIDROPZONE_CONFIG_PATH: configPath,
      AIDROPZONE_PORT: String(BUNDLED_BACKEND_PORT),
      AIDROPZONE_PACKAGED: '1',
      AIDROPZONE_EXE_DIR: exeDir,
    },
    windowsHide: true,
    stdio: 'ignore',
  });

  backendPid = backendProcess.pid ?? null;

  backendProcess.on('error', error => {
    console.error('[backend] spawn error:', error);
  });

  backendProcess.on('exit', (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`[backend] exited code=${code} signal=${signal ?? ''}`);
    }
  });

  await waitForBackendReady();
}

export function stopBundledBackend(): Promise<void> {
  if (backendPid == null) {
    return Promise.resolve();
  }

  const pid = backendPid;
  backendPid = null;
  backendProcess = null;

  return new Promise(resolve => {
    treeKill(pid, 'SIGTERM', () => resolve());
  });
}

export function getBundledApiBase(): string {
  return app.isPackaged ? BUNDLED_API_BASE : '';
}
