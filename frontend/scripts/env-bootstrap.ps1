$ErrorActionPreference = "Stop"

Write-Host "== AI Dropzone 环境一键修复 ==" -ForegroundColor Cyan

function Get-NodeMajor {
  $v = node -v
  if ($v -match '^v(\d+)\.') { return [int]$Matches[1] }
  throw "无法识别 Node 版本: $v"
}

$nodeMajor = Get-NodeMajor
if ($nodeMajor -lt 18 -or $nodeMajor -gt 22) {
  Write-Warning "当前 Node 版本不在推荐范围 (18/20/22 LTS)。检测到: $(node -v)"
  Write-Host "尝试使用 nvm 自动切换到 Node 20.18.0..." -ForegroundColor Yellow
  $nvmExists = Get-Command nvm -ErrorAction SilentlyContinue
  if ($null -ne $nvmExists) {
    nvm install 20.18.0 | Out-Host
    nvm use 20.18.0 | Out-Host
    Write-Host "请关闭并重新打开终端，再重新执行: npm run env:bootstrap" -ForegroundColor Yellow
    exit 1
  } else {
    throw "未检测到 nvm。请先安装 Node 20 LTS，然后重新执行 npm run env:bootstrap"
  }
}

Write-Host "Node 版本通过: $(node -v)" -ForegroundColor Green
Write-Host "清理旧依赖..." -ForegroundColor Cyan

if (Test-Path ".\node_modules") {
  Remove-Item ".\node_modules" -Recurse -Force
}

if (Test-Path ".\package-lock.json") {
  Remove-Item ".\package-lock.json" -Force
}

Write-Host "清理 npm 缓存..." -ForegroundColor Cyan
npm cache clean --force | Out-Host

Write-Host "重新安装依赖..." -ForegroundColor Cyan
npm install | Out-Host

Write-Host "验证 Electron 安装..." -ForegroundColor Cyan
node -e "console.log(require('electron'))" | Out-Host

Write-Host "验证 Electron 构建..." -ForegroundColor Cyan
npm run build:electron | Out-Host

Write-Host "环境修复完成" -ForegroundColor Green
Write-Host "下一步可执行: npm run electron:dev:full" -ForegroundColor Green
