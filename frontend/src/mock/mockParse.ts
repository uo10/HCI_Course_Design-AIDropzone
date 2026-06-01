import type { FileItem } from '../types/fileItem';

/** 识别是否为同一次拖入的同一文件（浏览器 File 无路径） */
export function fileDropKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function mockParseFromFile(
  file: File,
  sourcePath = '',
): Omit<FileItem, 'id' | 'droppedAt' | 'status' | 'dropKey' | 'justCompleted'> {
  const name = file.name;
  const ext = extOf(name);
  const stem = name.replace(/\.[^.]+$/, '');
  const hash = Math.random().toString(36).slice(2, 8);
  const sensitive = /身份证|简历|成绩单|合同|密码|病历/.test(name);

  const tags = new Set<string>();
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) tags.add('image');
  else if (/\.(doc|docx|pdf|md|txt)$/i.test(name)) tags.add('document');
  else tags.add('file');
  if (/hci|期末|课程|报告/i.test(name)) tags.add('hci');
  if (sensitive) tags.add('sensitive');

  function primaryTagFromTags(t: Set<string>): string {
    const arr = [...t].filter(x => x !== 'sensitive');
    return arr[0] ?? 'file';
  }

  let categoryReason = '根据文件扩展名与文件名关键词进行自动分类。';
  if (/hci|期末/i.test(name)) {
    categoryReason = '根据文件名中的关键词判断其属于 HCI 课程期末项目资料。';
  } else if (/screenshot|截图/i.test(name)) {
    categoryReason = '根据文件名判断为屏幕截图类图片素材。';
  }

  const suggestedName =
    /hci|期末|报告/i.test(name)
      ? `HCI课程_AI_Dropzone_${stem}${ext ? '.' + ext : ''}`
      : `${primaryTagFromTags(tags)}_${hash}_${stem}${ext ? '.' + ext : ''}`;

  return {
    sourcePath,
    name,
    suggestedName,
    tags: [...tags],
    categoryReason,
    extension: ext || 'unknown',
    sensitive,
  };
}

export function createPlaceholderFromDrop(file: File, sourcePath = ''): FileItem {
  const ext = extOf(file.name);
  return {
    id: Math.random().toString(36).slice(2, 10),
    dropKey: fileDropKey(file),
    sourcePath,
    name: file.name,
    suggestedName: file.name,
    tags: [],
    categoryReason: '',
    status: 'parsing',
    droppedAt: new Date(),
    extension: ext || 'unknown',
    sensitive: false,
    justCompleted: false,
  };
}

export function createFileItemFromDrop(file: File, sourcePath = ''): FileItem {
  const parsed = mockParseFromFile(file, sourcePath);
  return {
    ...parsed,
    id: Math.random().toString(36).slice(2, 10),
    dropKey: fileDropKey(file),
    droppedAt: new Date(),
    status: 'processed',
    justCompleted: true,
  };
}

const MOCK_PARSE_DELAY_MS = 520;

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export { MOCK_PARSE_DELAY_MS };
