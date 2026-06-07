/** 将后端/Mock/LLM 返回的 categoryReason 统一拆成与 Mock 一致的分行展示 */

import type { FileCategory } from '../api/types';

export type ReasonLineKind = 'cot' | 'desc' | 'style' | 'extra' | 'meta' | 'other';

export interface ReasonLine {
  kind: ReasonLineKind;
  /** 行首小标题；思维链等长段落可无 */
  label?: string;
  text: string;
}

/** 与 backend mock_ai_parser.CATEGORY_DESCRIPTIONS 对齐，仅用于前端展示补全 */
const CATEGORY_DESCRIPTIONS: Record<FileCategory, string> = {
  document: '标准文本文档，可用于记录、撰写或编辑文字内容',
  image: '位图或矢量图像文件，通常用于视觉展示或设计素材',
  video: '视频文件，包含动态影像及可能的音轨',
  audio: '音频文件，包含录制的声音或音乐内容',
  archive: '压缩归档文件，内含一个或多个打包文件',
  code: '源代码或结构化数据文件，供程序解析或编辑',
  spreadsheet: '电子表格文件，包含表格化的数值或文本数据',
  presentation: '幻灯片演示文稿，用于汇报、展示或教学',
  pdf: 'PDF 便携式文档，适合跨平台分享与打印',
  unknown: '暂无法识别的文件类型，建议人工确认',
};

/** 后端 read_text_preview 会跳过的扩展名（与 file_preview._BINARY_EXTENSIONS 一致） */
const BINARY_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'svg',
  'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv',
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'obj', 'o', 'class',
  'pyc', 'pyo', 'pyd',
]);

export function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ''));
}

function isStructuredMockSummary(summary: string): boolean {
  const t = summary.trim();
  return t.includes('|') || t.startsWith('[思维链]');
}

/** LLM 常返回单段中文；补成 Mock 同款 `[思维链]` 前缀 */
export function normalizeSummaryForDisplay(summary: string): string {
  const t = summary.trim();
  if (!t || isStructuredMockSummary(t)) return t;
  return `[思维链] ${t}`;
}

export function formatFileSizeLabel(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '';
  const kb = sizeBytes / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)}MB`;
  if (kb >= 1) return `${Math.round(kb)}KB`;
  return `${sizeBytes}B`;
}

function splitMetaPart(part: string): ReasonLine[] {
  const m = part.match(/^文件大小\s*([^，,]+)\s*[，,]\s*SHA256=(\S+)/);
  if (m) {
    return [
      { kind: 'meta', label: '文件大小', text: m[1].trim() },
      { kind: 'meta', label: 'SHA256', text: m[2].trim() },
    ];
  }
  if (part.startsWith('文件大小')) {
    return [{ kind: 'meta', label: '文件大小', text: part.replace(/^文件大小\s*/, '').trim() }];
  }
  if (part.includes('SHA256=')) {
    const sha = part.match(/SHA256=(\S+)/)?.[1] ?? part;
    return [{ kind: 'meta', label: 'SHA256', text: sha }];
  }
  return [{ kind: 'meta', text: part }];
}

function classifyPart(part: string): ReasonLine[] {
  const trimmed = part.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[思维链]')) {
    return [{ kind: 'cot', text: trimmed }];
  }
  if (trimmed.startsWith('风格要求:')) {
    return [
      {
        kind: 'style',
        label: '风格要求',
        text: trimmed.slice('风格要求:'.length).trim(),
      },
    ];
  }
  if (trimmed.startsWith('本次要求:')) {
    return [
      {
        kind: 'extra',
        label: '本次要求',
        text: trimmed.slice('本次要求:'.length).trim(),
      },
    ];
  }
  if (trimmed.startsWith('文件大小') || trimmed.includes('SHA256=')) {
    return splitMetaPart(trimmed);
  }
  return [{ kind: 'desc', text: trimmed }];
}

function insertAfterKind(lines: ReasonLine[], kind: ReasonLineKind, line: ReasonLine): void {
  const idx = lines.map(l => l.kind).lastIndexOf(kind);
  if (idx === -1) {
    lines.push(line);
    return;
  }
  lines.splice(idx + 1, 0, line);
}

export interface ParseReasonOptions {
  lastExtraPrompt?: string;
  persistentStylePrompt?: string;
  parseCategory?: FileCategory;
  fileSizeBytes?: number;
  extension?: string;
}

/**
 * 解析 summary 并补全 Mock 同款结构（思维链 / 类型说明 / 风格 / 本次要求 / 文件大小）。
 * LLM 响应通常只有一段分析文字，由前端在此统一格式化，不依赖改后端。
 */
export function parseCategoryReason(
  summary: string,
  lastExtraPrompt?: string,
  persistentStylePrompt?: string,
  options: Omit<ParseReasonOptions, 'lastExtraPrompt' | 'persistentStylePrompt'> = {},
): ReasonLine[] {
  const { parseCategory, fileSizeBytes, extension } = options;

  const normalized = normalizeSummaryForDisplay(summary);
  const lines: ReasonLine[] = [];

  if (normalized) {
    const parts = normalized.includes('|') ? normalized.split(/\s*\|\s*/) : [normalized];
    for (const part of parts) {
      lines.push(...classifyPart(part));
    }
  }

  if (!lines.some(l => l.kind === 'desc') && parseCategory) {
    const desc = CATEGORY_DESCRIPTIONS[parseCategory];
    if (desc) {
      insertAfterKind(lines, 'cot', { kind: 'desc', text: desc });
    }
  }

  const hasStyleInSummary = lines.some(l => l.kind === 'style');
  if (persistentStylePrompt?.trim() && !hasStyleInSummary) {
    const styleLine: ReasonLine = {
      kind: 'style',
      label: '风格要求',
      text: persistentStylePrompt.trim(),
    };
    const insertAt = lines.findIndex(l => l.kind === 'extra' || l.kind === 'meta');
    if (insertAt === -1) {
      lines.push(styleLine);
    } else {
      lines.splice(insertAt, 0, styleLine);
    }
  }

  const hasExtraInSummary = lines.some(l => l.kind === 'extra');
  const extra = lastExtraPrompt?.trim();
  if (extra && !hasExtraInSummary) {
    lines.push({ kind: 'extra', label: '本次要求', text: extra });
  }

  const hasSizeMeta = lines.some(l => l.kind === 'meta' && l.label === '文件大小');
  const sizeLabel = fileSizeBytes != null ? formatFileSizeLabel(fileSizeBytes) : '';
  if (sizeLabel && !hasSizeMeta) {
    lines.push({ kind: 'meta', label: '文件大小', text: sizeLabel });
  }

  const ext = extension?.replace(/^\./, '').toLowerCase() ?? '';
  const hasContentNote = lines.some(l => l.text.includes('内容预览'));
  if (ext && isBinaryExtension(ext) && !hasContentNote && !isStructuredMockSummary(summary)) {
    lines.push({
      kind: 'meta',
      label: '内容预览',
      text: `未读取正文（.${ext} 为二进制格式），分析仅依据文件名与元数据`,
    });
  }

  return lines;
}
