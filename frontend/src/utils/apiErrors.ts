import { getApiBase } from '../services/dropzoneApi';

export function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg === 'failed to fetch' ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

/** 把浏览器原生 Failed to fetch 换成可操作的说明 */
/** 用户常把 DeepSeek 官方地址误填进「本地后端地址」 */
export function looksLikeLlmVendorUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.includes('deepseek.com') ||
    u.includes('api.openai.com') ||
    u.includes('openai.com/v1') ||
    u.includes('anthropic.com')
  );
}

export function validateLocalApiBase(url: string): string | null {
  const t = url.trim();
  if (!t) return '请填写本地后端地址';
  if (looksLikeLlmVendorUrl(t)) {
    return (
      '「本地后端地址」应填本机 uvicorn（例如 http://127.0.0.1:8000），' +
      '不要填 DeepSeek 官网地址。DeepSeek API Key 请在下方单独填写。'
    );
  }
  return null;
}

export function formatApiError(err: unknown): string {
  if (isNetworkFetchError(err)) {
    const base = getApiBase();
    if (looksLikeLlmVendorUrl(base)) {
      return validateLocalApiBase(base) ?? 'API 地址配置有误';
    }
    return (
      `无法连接本地后端 ${base}。请先在项目根目录启动：\n` +
      `uvicorn backend.main:app --host 127.0.0.1 --port 8000\n` +
      `或在「设置」中开启 Mock 模式后保存并刷新。`
    );
  }
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (msg === 'HTTP 404' || msg.startsWith('HTTP 404')) {
      const base = getApiBase();
      if (looksLikeLlmVendorUrl(base)) {
        return validateLocalApiBase(base) ?? msg;
      }
      return (
        `本地后端返回 404（${base}）。请确认 uvicorn 已启动且地址为 http://127.0.0.1:8000；` +
        `DeepSeek 密钥不要填在「本地后端地址」里。`
      );
    }
    return msg;
  }
  return '解析失败';
}
