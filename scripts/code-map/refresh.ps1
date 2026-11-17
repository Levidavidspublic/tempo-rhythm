$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pluginRoot = Join-Path $repoRoot '.code-map-tools/understand-anything/understand-anything-plugin'
if (-not (Test-Path -LiteralPath (Join-Path $pluginRoot 'packages/core/dist/index.js'))) { throw 'Run scripts/code-map/setup.ps1 first' }
$dataDir = Join-Path $repoRoot '.understand-anything/intermediate'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
Push-Location $repoRoot
try {
    uvx --from graphifyy==0.9.74 graphify extract . --code-only --no-cluster --max-workers 1
    if ($LASTEXITCODE -ne 0) { throw 'Graphify AST refresh failed' }
    $scanPath = Join-Path $dataDir 'scan-result.json'
    $mapPath = Join-Path $dataDir 'import-map.json'
    node (Join-Path $pluginRoot 'skills/understand/scan-project.mjs') $repoRoot $scanPath --exclude-analysis-data --exclude 'convex/**,packages/backend/convex/**,.env*,**/.env*,.code-map-tools/**,.git/**'
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything deterministic scan failed' }
    $scanData = Get-Content -LiteralPath $scanPath -Raw | ConvertFrom-Json
    $scanData | Add-Member -NotePropertyName projectRoot -NotePropertyValue $repoRoot -Force
    [System.IO.File]::WriteAllText($scanPath, ($scanData | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding $false))
    node (Join-Path $pluginRoot 'skills/understand/extract-import-map.mjs') $scanPath $mapPath
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything import map failed' }
} finally { Pop-Location }
Write-Output 'Graphify AST graph and Understand-Anything inventory/import map refreshed. Semantic graph generation remains a separate subscription-agent task.'
