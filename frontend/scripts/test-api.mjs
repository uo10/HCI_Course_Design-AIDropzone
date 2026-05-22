/**
 * 后端 HTTP 连通性测试（只读契约，不改 backend）
 *
 * 用法：
 *   node scripts/test-api.mjs
 *   node scripts/test-api.mjs http://127.0.0.1:8000
 *
 * 先让后端同学启动 HTTP 网关，再运行本脚本。
 */

const BASE = (process.argv[2] || process.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
);

/** 改成你本机真实存在的文件路径（rename 预览用） */
const TEST_FILE = process.env.TEST_FILE || 'C:\\Users\\demo\\Desktop\\screenshot_web.png';

async function post(path, body) {
  const url = `${BASE}${path}`;
  console.log(`\n>>> POST ${url}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log('HTTP', res.status, text.slice(0, 500));
    throw new Error('响应不是 JSON，请确认后端已启动且地址正确');
  }
  console.log('HTTP', res.status);
  console.log(JSON.stringify(json, null, 2));
  return json;
}

async function main() {
  console.log('BASE =', BASE);
  console.log('TEST_FILE =', TEST_FILE);

  // 1. parse
  const parseRes = await post('/parse', {
    file: {
      path: TEST_FILE,
      size_bytes: 1024,
      extension: 'png',
      mime_type: 'image/png',
      name_before_drop: 'screenshot_web.png',
    },
    prefer_mock: true,
  });
  if (parseRes.status !== 'success') {
    console.error('\n[失败] /parse');
    process.exit(1);
  }
  console.log('\n[通过] /parse');

  // 2. rename 预览（dry_run，不写盘）
  const renamePreview = await post('/rename', {
    items: [
      {
        source_path: TEST_FILE,
        new_name: 'screenshot_web.png',
        tags_applied: ['image', 'screenshot'],
        notes: '',
      },
    ],
    dry_run: true,
    conflict_mode: 'auto_increment',
  });
  if (renamePreview.status !== 'success') {
    console.error('\n[失败] /rename dry_run');
    process.exit(1);
  }
  console.log('\n[通过] /rename dry_run');

  // 3. undo（无操作时可能返回 failure，仅测接口通不通）
  const undoRes = await post('/undo', { count: 1, filter_operation: 'rename' });
  console.log(
    undoRes.status === 'success' ? '\n[通过] /undo' : '\n[提示] /undo 无记录可撤（接口可达即可）',
  );

  // 4. export（依赖 backend/workspace 里真有带标签的文件名）
  const exportRes = await post('/export', {
    tags: ['document'],
    output_dir: 'C:\\Users\\demo\\Desktop',
    package_name: 'test_export',
    include_manifest: true,
  });
  console.log(
    exportRes.status === 'success'
      ? '\n[通过] /export'
      : '\n[提示] /export 可能无匹配文件，看 status 与 error',
  );

  console.log('\n全部请求已发出。若 HTTP 连不上，请向后端确认网关地址与端口。');
}

main().catch((err) => {
  console.error('\n错误:', err.message);
  console.error('常见原因: 后端未启动、端口不对、CORS 仅影响浏览器不影响本脚本');
  process.exit(1);
});
