import { useEffect, useRef } from 'react';
import { getApiConfig } from '../api/client';

/** HTTP 模式下启动时探测后端是否在线 */
export function useBackendHealth(
  showToast: (kind: 'success' | 'error' | 'info', message: string) => void,
): void {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const { mode, baseUrl } = getApiConfig();
    if (mode !== 'http' || !baseUrl) return;

    const url = `${baseUrl.replace(/\/$/, '')}/openapi.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    void fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast('success', `后端已连接：${baseUrl}`);
      })
      .catch(() => {
        showToast(
          'error',
          `无法连接后端 ${baseUrl}。请先在仓库根目录运行：uvicorn backend.main:app --host 127.0.0.1 --port 8000`,
        );
      })
      .finally(() => {
        clearTimeout(timer);
      });
  }, [showToast]);
}
