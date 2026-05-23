import { getApiConfig } from '../api/client';

export function ApiModeBanner() {
  const { mode, baseUrl } = getApiConfig();

  if (mode === 'mock') {
    return (
      <div className="api-mode-banner api-mode-banner--mock" role="status">
        <strong>演示模式（Mock）</strong>
        <span>
          解析/改名/导出/撤销均为内存模拟，<em>不会</em>修改磁盘。完整功能请用{' '}
          <code>npm run electron:dev:full</code> 并先启动后端。
        </span>
      </div>
    );
  }

  return (
    <div className="api-mode-banner api-mode-banner--http" role="status">
      <strong>完整模式（HTTP）</strong>
      <span>
        已配置后端 <code>{baseUrl}</code> — 拖入真实文件后可真改名、真导出、真撤销。
      </span>
    </div>
  );
}
