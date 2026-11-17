$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeRoot = Join-Path $repoRoot '.code-map-tools/understand-anything'
$sourceCommit = 'b861852dda79273bd9d2e01c3160d42e2df510d2'
foreach ($toolName in @('git', 'node', 'pnpm', 'uvx')) {
    if (-not (Get-Command $toolName -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $toolName" }
}
if (-not (Test-Path -LiteralPath $runtimeRoot)) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $runtimeRoot) | Out-Null
    git clone --no-checkout --depth 1 --filter=blob:none https://github.com/Egonex-AI/Understand-Anything.git $runtimeRoot
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything clone failed' }
    git -C $runtimeRoot fetch --depth 1 origin $sourceCommit
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything pinned fetch failed' }
    git -C $runtimeRoot checkout --detach $sourceCommit
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything pinned checkout failed' }
}
$actualCommit = git -C $runtimeRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $actualCommit.Trim() -ne $sourceCommit) { throw 'Existing runtime has a different revision; preserve it and resolve explicitly' }
$runtimeStatus = git -C $runtimeRoot status --porcelain
if ($runtimeStatus) { throw 'Existing tool source is dirty; preserve it and resolve explicitly' }
$licenseText = Get-Content -LiteralPath (Join-Path $runtimeRoot 'LICENSE') -Raw
if ($licenseText -notmatch 'MIT License') { throw 'Understand-Anything license verification failed' }
Push-Location $runtimeRoot
try {
    pnpm install --filter '@understand-anything/core...' --frozen-lockfile --ignore-scripts --child-concurrency=1 --network-concurrency=4
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything dependency install failed' }
    pnpm --filter '@understand-anything/core' build
    if ($LASTEXITCODE -ne 0) { throw 'Understand-Anything core build failed' }
} finally { Pop-Location }
uvx --from graphifyy==0.9.74 graphify --version
if ($LASTEXITCODE -ne 0) { throw 'Pinned Graphify runtime verification failed' }
Write-Output 'Code-map runtimes ready locally; no dashboard, API inference or user-profile configuration was started.'
