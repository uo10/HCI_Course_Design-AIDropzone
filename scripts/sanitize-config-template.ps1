# Ensure config templates shipped in installers contain no secrets or personal paths.
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ConfigPath)) {
    throw "Config not found: $ConfigPath"
}

$json = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

$json.workspace_root = ""
$json.naming_style_prompt = ""
if ($null -eq $json.ai_parser_options) {
    $json | Add-Member -NotePropertyName ai_parser_options -NotePropertyValue (@{})
}
if ($null -eq $json.ai_parser_options.llm) {
    $json.ai_parser_options | Add-Member -NotePropertyName llm -NotePropertyValue (@{})
}
$json.ai_parser_options.llm.api_key = ""

$out = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($ConfigPath, $out + "`n", [System.Text.UTF8Encoding]::new($false))

$verify = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($verify.ai_parser_options.llm.api_key) {
    throw "Sanitize failed: api_key still set in $ConfigPath"
}

Write-Host "Sanitized: $ConfigPath"
