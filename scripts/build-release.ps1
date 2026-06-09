# AI Dropzone — one-click NSIS release build (Windows x64)
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\scripts\build-release.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Assert-InstallerConfigClean {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Missing bundled config: $Path"
    }
    $raw = Get-Content $Path -Raw -Encoding UTF8
    if ($raw -match 'sk-[a-zA-Z0-9]{8,}') {
        throw "REFUSE BUILD: API key pattern found in $Path"
    }
    $json = $raw | ConvertFrom-Json
    if ($json.ai_parser_options.llm.api_key -and "$($json.ai_parser_options.llm.api_key)".Trim()) {
        throw "REFUSE BUILD: api_key must be empty in $Path"
    }
}

Write-Host "==> [0/4] Sanitize config templates (no API key / personal paths)" -ForegroundColor Cyan
& (Join-Path $RepoRoot "scripts\sanitize-config-template.ps1") (Join-Path $RepoRoot "backend\config.example.json")
& (Join-Path $RepoRoot "scripts\sanitize-config-template.ps1") (Join-Path $RepoRoot "backend\config.json")

Write-Host "==> [1/4] PyInstaller backend (aidropzone-server.exe)" -ForegroundColor Cyan

$venvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }

& $python -m pip install -q -r requirements.txt
& $python -m pip install -q -r requirements-build.txt

$backendDist = Join-Path $RepoRoot "backend\dist\aidropzone-server"
if (Test-Path $backendDist) {
    Remove-Item -Recurse -Force $backendDist
}

& $python -m PyInstaller --noconfirm `
  --distpath (Join-Path $RepoRoot "backend\dist") `
  --workpath (Join-Path $RepoRoot "backend\build\pyinstaller-work") `
  (Join-Path $RepoRoot "backend\build\pyinstaller.spec")

$serverExe = Join-Path $backendDist "aidropzone-server.exe"
if (-not (Test-Path $serverExe)) {
    throw "PyInstaller output missing: $serverExe"
}

$bundledExample = Join-Path $backendDist "_internal\backend\config.example.json"
Assert-InstallerConfigClean $bundledExample
$leakedConfig = Join-Path $backendDist "_internal\backend\config.json"
if (Test-Path $leakedConfig) {
    Remove-Item -Force $leakedConfig
    Write-Host "Removed leaked backend/config.json from PyInstaller output" -ForegroundColor Yellow
}

Write-Host "==> [2/4] Vite frontend (full / HTTP mode)" -ForegroundColor Cyan
Set-Location (Join-Path $RepoRoot "frontend")
if (-not (Test-Path "node_modules")) {
    npm install
}
npx vite build --mode full

Write-Host "==> [3/4] Electron main/preload" -ForegroundColor Cyan
npm run build:electron

Write-Host "==> [4/4] electron-builder NSIS installer" -ForegroundColor Cyan
npx electron-builder

Write-Host ""
Write-Host "Done. Installer:" -ForegroundColor Green
Get-ChildItem (Join-Path $RepoRoot "frontend\release") -Filter "*Setup*.exe" | ForEach-Object {
    Write-Host "  $($_.FullName)"
}
