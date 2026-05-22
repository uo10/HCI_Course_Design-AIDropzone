import type {
  ExportRequest,
  ExportResult,
  FileCategory,
  ParseRequest,
  ParseResult,
  RenameRequest,
  RenameResult,
  UndoRequest,
  UndoResult,
} from './types';
import type { ApiClient } from './client';
import { getLastRenameSnapshot } from './undoSnapshot';

const MOCK_DELAY_MIN_MS = 300;
const MOCK_DELAY_MAX_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  const ms =
    MOCK_DELAY_MIN_MS +
    Math.floor(Math.random() * (MOCK_DELAY_MAX_MS - MOCK_DELAY_MIN_MS + 1));
  return delay(ms);
}

function shouldSimulateParseFailure(path: string, extension: string): boolean {
  return extension === 'xyz' || path.includes('__fail__');
}

function buildSuggestedName(metadata: ParseRequest['file']): string {
  const base = metadata.name_before_drop.replace(/\.[^.]+$/, '');
  const hash = Math.random().toString(16).slice(2, 10);
  return `${metadata.extension}_${hash}_${base}.${metadata.extension}`;
}

function categoryFromExtension(ext: string): FileCategory {
  const map: Record<string, FileCategory> = {
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    pdf: 'pdf',
    doc: 'document',
    docx: 'document',
    txt: 'document',
    md: 'document',
    mp4: 'video',
    mp3: 'audio',
    zip: 'archive',
    ts: 'code',
    tsx: 'code',
    js: 'code',
    py: 'code',
  };
  return map[ext] ?? 'unknown';
}

export class MockApiClient implements ApiClient {
  async parse(req: ParseRequest): Promise<ParseResult> {
    await randomDelay();

    const { file } = req;
    if (shouldSimulateParseFailure(file.path, file.extension)) {
      return {
        status: 'failure',
        data: null,
        error: `不支持的文件类型：.${file.extension}。可改用手动整理或仅暂存。`,
      };
    }

    const category = categoryFromExtension(file.extension);
    const tags =
      category === 'image'
        ? ['image', 'media']
        : category === 'document' || category === 'pdf'
          ? ['document']
          : [category];

    return {
      status: 'success',
      data: {
        file_path: file.path,
        suggested_name: buildSuggestedName(file),
        category,
        tags,
        summary:
          category === 'image'
            ? '一张图片文件，已生成命名与标签建议。'
            : '文件已解析，请确认建议名与标签。',
        keywords: [file.name_before_drop.replace(/\.[^.]+$/, '')],
        confidence: 0.85,
        parsed_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  async rename(req: RenameRequest): Promise<RenameResult> {
    await randomDelay();

    const dry_run = req.dry_run ?? false;
    const renamed: RenameResult['renamed'] = [];
    const skipped: RenameResult['skipped'] = [];
    const errors: RenameResult['errors'] = [];

    for (const item of req.items) {
      if (!item.new_name.trim()) {
        errors.push({ path: item.source_path, error: '新文件名为空' });
        continue;
      }

      const dir = item.source_path.replace(/\\[^\\]+$/, '') || item.source_path;
      const tag = item.tags_applied[0] ?? 'file';
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const base = item.new_name.replace(/\.[^.]+$/, '');
      const extMatch = item.new_name.match(/(\.[^.]+)$/);
      const ext = extMatch ? extMatch[1].slice(1) : '';
      const finalName = ext ? `${tag}_${date}_${base}.${ext}` : `${tag}_${date}_${base}`;
      const newPath = `${dir}\\${finalName}`;

      if (item.source_path === newPath) {
        skipped.push({ path: item.source_path, reason: 'unchanged' });
        continue;
      }

      renamed.push({
        old: item.source_path,
        new: newPath,
        tags: [...item.tags_applied],
      });
    }

    const status =
      errors.length > 0 && renamed.length === 0 ? 'failure' : 'success';

    return {
      status,
      dry_run,
      renamed,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  async export(req: ExportRequest): Promise<ExportResult> {
    await randomDelay();

    if (!req.tags.length) {
      return {
        status: 'failure',
        error: '请至少选择一个标签。',
      };
    }

    const pkg = req.package_name?.trim() || 'export';
    const dir = req.output_dir.replace(/[/\\]+$/, '');
    const zip_path = `${dir}\\${pkg}.zip`;

    return {
      status: 'success',
      zip_path,
      error: null,
    };
  }

  async undo(req: UndoRequest): Promise<UndoResult> {
    await randomDelay();
    const snapshot = getLastRenameSnapshot();

    if (snapshot.length === 0) {
      return {
        status: 'failure',
        undone: [],
        failed: [{ entry_id: 0, error: '没有可撤销的改名操作。' }],
        remaining_log_size: 0,
      };
    }

    const count = Math.min(req.count, snapshot.length);
    const undone = snapshot.slice(0, count).map((entry, i) => ({
      entry_id: i + 1,
      operation: 'rename' as const,
      timestamp: new Date().toISOString(),
      original_path: entry.oldPath,
      new_path: entry.newPath,
      tags_snapshot: [],
      metadata: {},
    }));

    // 快照由 hook 在 UI 恢复成功后清除，避免 API 先清空导致撤销失败
    return {
      status: 'success',
      undone,
      failed: [],
      remaining_log_size: Math.max(0, snapshot.length - count),
    };
  }
}
