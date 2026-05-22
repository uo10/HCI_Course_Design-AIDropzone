const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist-electron');

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('.js')) continue;
  const from = path.join(dir, name);
  const to = path.join(dir, name.replace(/\.js$/, '.cjs'));
  if (fs.existsSync(to)) fs.unlinkSync(to);
  fs.renameSync(from, to);
}
