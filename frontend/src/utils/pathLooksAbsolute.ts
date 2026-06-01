/** 判断是否为「像磁盘绝对路径」的字符串（避免把相对路径交给后端按 cwd 解析） */
export function pathLooksAbsolute(p: string): boolean {
  const t = p.trim();
  if (!t) return false;
  if (t.startsWith('\\\\')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(t)) return true;
  if (t.startsWith('/')) return true;
  return false;
}
