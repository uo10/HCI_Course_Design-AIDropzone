#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
  } catch (err) {
    const out = String(err.stdout || err.stderr || err.message || '').trim();
    return out || null;
  }
}

function getMajor(versionLike) {
  const m = String(versionLike || '').match(/v?(\d+)\./);
  return m ? Number(m[1]) : NaN;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}
function warn(msg) {
  console.log(`⚠️  ${msg}`);
}
function fail(msg) {
  console.log(`❌ ${msg}`);
}

console.log('AI Dropzone 环境自检 (frontend)');
console.log('--------------------------------');

const nodeVersion = process.version;
const nodeMajor = getMajor(nodeVersion);
if (Number.isNaN(nodeMajor)) {
  fail(`无法识别 Node 版本: ${nodeVersion}`);
  process.exitCode = 1;
} else if (nodeMajor < 18 || nodeMajor > 22) {
  fail(`Node ${nodeVersion} 不在推荐范围 (18/20/22 LTS)`);
  warn('建议安装并使用 Node 20 LTS，再执行 npm run env:bootstrap');
  process.exitCode = 1;
} else {
  ok(`Node 版本可用: ${nodeVersion}`);
}

const npmVersion = run('npm -v');
if (!npmVersion) {
  fail('npm 不可用');
  process.exitCode = 1;
} else {
  ok(`npm 版本: ${npmVersion}`);
}

const localTsc = run('npx tsc -v');
if (!localTsc || /not found|could not/i.test(localTsc)) {
  fail('项目本地 TypeScript 不可用（请先 npm install）');
  process.exitCode = 1;
} else {
  ok(`本地 TypeScript: ${localTsc}`);
}

const electronPath = run(`node -e "console.log(require('electron'))"`);
if (!electronPath || /failed to install correctly|cannot find module/i.test(electronPath)) {
  fail('Electron 安装损坏或缺失');
  warn('执行 npm run env:bootstrap 自动重装依赖并修复 electron');
  process.exitCode = 1;
} else {
  ok(`Electron 可执行文件: ${electronPath}`);
}

const buildCheck = run('npm run -s build:electron');
if (buildCheck === null) {
  fail('build:electron 执行失败');
  process.exitCode = 1;
} else {
  ok('build:electron 通过');
}

if (process.exitCode && process.exitCode !== 0) {
  console.log('--------------------------------');
  console.log('自检未通过。建议执行：npm run env:bootstrap');
} else {
  console.log('--------------------------------');
  console.log('环境就绪，可以直接运行：npm run electron:dev:full');
}
