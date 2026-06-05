/** 将后端/Mock 返回的 categoryReason 拆成可分行展示的结构 */

export type ReasonLineKind = 'cot' | 'desc' | 'style' | 'extra' | 'meta' | 'other';

export interface ReasonLine {
  kind: ReasonLineKind;
  /** 行首小标题；思维链等长段落可无 */
  label?: string;
  text: string;
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

/**
 * 解析 summary 字符串（Mock 常用 ` | ` 分隔；LLM 可能为单段）。
 * @param lastExtraPrompt 重生成时用户填写的单次说明（LLM 响应可能未写回 summary）
 */
export function parseCategoryReason(
  summary: string,
  lastExtraPrompt?: string,
): ReasonLine[] {
  const raw = summary.trim();
  if (!raw) {
    if (lastExtraPrompt?.trim()) {
      return [{ kind: 'extra', label: '本次要求', text: lastExtraPrompt.trim() }];
    }
    return [];
  }

  const parts = raw.includes('|') ? raw.split(/\s*\|\s*/) : [raw];
  const lines: ReasonLine[] = [];
  for (const part of parts) {
    lines.push(...classifyPart(part));
  }

  const hasExtraInSummary = lines.some(l => l.kind === 'extra');
  if (lastExtraPrompt?.trim() && !hasExtraInSummary) {
    lines.push({ kind: 'extra', label: '本次要求', text: lastExtraPrompt.trim() });
  }

  return lines;
}
