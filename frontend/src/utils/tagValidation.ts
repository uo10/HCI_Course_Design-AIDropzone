const TAG_REGEX = /^[a-z0-9_]+$/;

export function validateTag(tag: string): string | null {
  const trimmed = tag.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    return '标签长度须为 1～64 字符';
  }
  if (!TAG_REGEX.test(trimmed)) {
    return '标签仅允许小写字母、数字和下划线';
  }
  return null;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}
