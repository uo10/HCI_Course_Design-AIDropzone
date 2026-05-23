import { withDisplayStatus } from '../utils/displayStatus';
import type { PipelineCard } from '../hooks/pipelineTypes';

/** 答辩 DemoMode 预制卡片（不调 API） */
export function buildDemoPipelineCards(): PipelineCard[] {
  const cards: PipelineCard[] = [
    {
      id: 'demo-stash-1',
      metadata: {
        path: 'C:\\Users\\demo\\Desktop\\draft_notes.txt',
        size_bytes: 2048,
        extension: 'txt',
        name_before_drop: 'draft_notes.txt',
      },
      status: 'complete',
      source_mode: 'stash_only',
      display_status: 'stashed',
      suggested_name: 'draft_notes.txt',
      tags: [],
      summary: '仅暂存，未调用 AI 解析。',
    },
    {
      id: 'demo-manual-1',
      metadata: {
        path: 'C:\\Users\\demo\\Documents\\invoice_march.pdf',
        size_bytes: 89000,
        extension: 'pdf',
        name_before_drop: 'invoice_march.pdf',
      },
      status: 'complete',
      source_mode: 'manual',
      display_status: 'manual_pending',
      suggested_name: 'invoice_march.pdf',
      tags: [],
      summary: '手动模式：请填写标签与目标文件名。',
    },
    {
      id: 'demo-manual-2',
      metadata: {
        path: 'C:\\Users\\demo\\Projects\\readme.md',
        size_bytes: 4096,
        extension: 'md',
        name_before_drop: 'readme.md',
      },
      status: 'complete',
      source_mode: 'manual',
      display_status: 'manual_ready',
      suggested_name: 'readme_v2.md',
      tags: ['document', 'readme'],
      summary: '手动模式：已填写标签，可预览改名。',
    },
    {
      id: 'demo-ai-1',
      metadata: {
        path: 'C:\\Users\\demo\\Desktop\\screenshot_web.png',
        size_bytes: 245760,
        extension: 'png',
        mime_type: 'image/png',
        name_before_drop: 'screenshot_web.png',
      },
      status: 'complete',
      source_mode: 'ai_assisted',
      display_status: 'parsed',
      suggested_name: 'image_a3f2b1c0_screenshot_web.png',
      category: 'image',
      tags: ['image', 'media', 'screenshot'],
      summary: 'AI 解析完成（演示数据）。',
      confidence: 0.85,
    },
    {
      id: 'demo-ai-2',
      metadata: {
        path: 'C:\\Users\\demo\\Downloads\\report_final.pdf',
        size_bytes: 512000,
        extension: 'pdf',
        name_before_drop: 'report_final.pdf',
      },
      status: 'complete',
      source_mode: 'ai_assisted',
      display_status: 'parsed',
      suggested_name: 'document_20260521_report_final.pdf',
      category: 'pdf',
      tags: ['document', 'report'],
      summary: 'AI 解析完成（演示数据）。',
      confidence: 0.82,
    },
  ];

  return cards.map((c) => withDisplayStatus(c));
}
