import { pathLooksAbsolute } from './pathLooksAbsolute';

/** 在「拖放同步栈」里解析成功后写入，供 react-dropzone 微任务阶段再次读取（同一 File 引用）。 */
const electronDropPathByFile = new WeakMap<File, string>();

/**
 * 在 Electron 拖入瞬间解析磁盘路径（File 对象失效前必须同步调用）。
 *
 * webUtils.getPathForFile 由 Chromium 保证为真实路径；不再用 pathLooksAbsolute 二次过滤，
 * 避免误杀合法格式（如 DOS 8.3、\\?\ 前缀等）导致「手选路径可以、拖拽失败」。
 * legacy.path 仍可能为相对路径，仅在为绝对路径时采用。
 */
export function resolveDroppedFilePath(file: File): string {
  const cached = electronDropPathByFile.get(file);
  if (cached != null && cached.length > 0) return cached;

  if (!window.dropzone?.isElectron) return '';

  try {
    const p = window.dropzone.getPathForFile(file);
    if (p && p.trim().length > 0) {
      const t = p.trim();
      electronDropPathByFile.set(file, t);
      return t;
    }
  } catch {
    // fall through
  }

  const legacy = file as File & { path?: string };
  if (legacy.path && legacy.path.trim().length > 0) {
    const t = legacy.path.trim();
    if (pathLooksAbsolute(t)) {
      electronDropPathByFile.set(file, t);
      return t;
    }
  }

  return '';
}
