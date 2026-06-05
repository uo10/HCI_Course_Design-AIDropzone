/** 与 backend/models/common.py Tag 约束对齐 */

const TAG_MAX_LEN = 64;
const FORBIDDEN = /[\s<>:"/\\|?*]/g;

export type NormalizeTagResult =
  | { ok: true; tag: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'too_long' };

/**
 * 规范化用户输入的标签。保留中文；仅剔除路径非法字符。
 */
export function normalizeUserTag(raw: string): NormalizeTagResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }

  const tag = trimmed.replace(FORBIDDEN, '');
  if (!tag) {
    return { ok: false, reason: 'invalid' };
  }

  if (tag.length > TAG_MAX_LEN) {
    return { ok: false, reason: 'too_long' };
  }

  return { ok: true, tag };
}

export function normalizeUserTagMessage(
  reason: 'empty' | 'invalid' | 'too_long',
): string {
  switch (reason) {
    case 'empty':
      return '标签不能为空';
    case 'invalid':
      return '标签不能包含空格或 <>:"/\\|?* 等符号';
    case 'too_long':
      return `标签最长 ${TAG_MAX_LEN} 个字符`;
    default:
      return '标签无效';
  }
}
