import type { FileCardViewModel, FileMetadata, ParseItem } from './types';

/** API_CONTRACT §1.1 示例 */
export const sampleFileMetadata: FileMetadata = {
  path: 'C:\\Users\\demo\\Desktop\\screenshot_web.png',
  size_bytes: 245760,
  extension: 'png',
  mime_type: 'image/png',
  name_before_drop: 'screenshot_web.png',
};

/** API_CONTRACT §2.4 成功响应里的 data */
export const sampleParseItem: ParseItem = {
  file_path: sampleFileMetadata.path,
  suggested_name: 'image_a3f2b1c0_screenshot_web.png',
  category: 'image',
  tags: ['image', 'media', 'screenshot'],
  summary: 'A raster or vector image file.',
  keywords: ['screenshot'],
  confidence: 0.85,
  parsed_at: '2026-05-12T08:30:00.123456',
};

/** 第二条模拟元数据（多点一次「模拟拖入」用） */
export const alternateFileMetadata: FileMetadata = {
  path: 'C:\\Users\\demo\\Documents\\report.pdf',
  size_bytes: 512000,
  extension: 'pdf',
  mime_type: 'application/pdf',
  name_before_drop: 'report.pdf',
};

/** 第 2 步：一张已解析完成的静态卡片 */
export const sampleFileCard: FileCardViewModel = {
  metadata: sampleFileMetadata,
  status: 'complete',
  suggested_name: sampleParseItem.suggested_name,
  category: sampleParseItem.category,
  tags: [...sampleParseItem.tags],
  summary: sampleParseItem.summary,
  confidence: sampleParseItem.confidence,
};
