const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist-electron');

if (!fs.existsSync(dir)) {
  console.error('[build:electron] dist-electron 目录不存在，请先确认 tsc 已成功执行。');
  process.exit(1);
}

let renamed = 0;
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.js')) continue;
  const from = path.join(dir, name);
  const to = path.join(dir, name.replace(/\.js$/, '.cjs'));
  if (fs.existsSync(to)) fs.unlinkSync(to);
  fs.renameSync(from, to);
  renamed += 1;
}

if (renamed === 0) {
  console.warn('[build:electron] dist-electron 内未找到 .js 输出，请检查 electron/**/*.ts 是否参与编译。');
} else {
  const cjs = fs.readdirSync(dir).filter(n => n.endsWith('.cjs'));
  console.log(`[build:electron] 完成：已将 ${renamed} 个文件重命名为 .cjs → ${cjs.join(', ')}`);
}
