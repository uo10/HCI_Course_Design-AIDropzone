/** 后端 LLM 失败时会在 summary 末尾追加降级标记（见 backend/main.py） */
const LLM_DEGRADED_RE = /\s*\|\s*\[LLM调用失败，已降级Mock:\s*([^\]]*)\]\s*/;

export interface LlmDegradedInfo {
  degraded: boolean;
  reason: string;
  cleanSummary: string;
}

export function extractLlmDegradedInfo(summary: string): LlmDegradedInfo {
  const match = summary.match(LLM_DEGRADED_RE);
  if (!match) {
    return { degraded: false, reason: '', cleanSummary: summary };
  }
  const reason = match[1]?.trim() ?? '';
  const cleanSummary = summary.replace(LLM_DEGRADED_RE, '').trim();
  return { degraded: true, reason, cleanSummary };
}

export function formatLlmDegradedMessage(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('401') || r.includes('authorization')) {
    return (
      'DeepSeek API Key 无效或已过期（401）。请到「设置」重新填写 Key 并保存，' +
      '然后重新拖入文件或点「重新生成」。当前标签与建议名来自 Mock 降级，不可信。'
    );
  }
  if (r.includes('403')) {
    return 'DeepSeek 拒绝访问（403），请检查 API Key 权限与余额。当前结果为 Mock 降级，不可信。';
  }
  if (r.includes('timeout') || r.includes('timed out')) {
    return `大模型请求超时：${reason}。请稍后重试或检查网络。当前结果为 Mock 降级，不可信。`;
  }
  if (r.includes('validation error') || r.includes('string should match')) {
    return (
      '大模型返回的标签格式不合法（含空格或特殊字符），解析被拒绝。' +
      '请点「重新生成」重试；长 PDF 更容易触发。当前结果为 Mock 降级，不可信。'
    );
  }
  return `大模型调用失败，当前结果为 Mock 降级占位，不可信：${reason || '未知错误'}`;
}
