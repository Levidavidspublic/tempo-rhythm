# Focused provisioning failure/retry and environment-restoration regression.
# Git/pnpm/uvx are mocked only for this control-flow test; live runtime proof
# is recorded separately and no model or remote service is called here.
$ErrorActionPreference = 'Stop'
$testRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$testRoot = Join-Path $testRepoRoot ('.code-map-tools/setup-tests/' + [Guid]::NewGuid().ToString('N'))
$testScriptDir = Join-Path $testRoot 'scripts/code-map'
New-Item -ItemType Directory -Force -Path $testScriptDir | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'setup.ps1') -Destination (Join-Path $testScriptDir 'setup.ps1')
$global:setupFetchFailures = 1
$global:setupCloneCount = 0
$previousAutoRefreshForTest = [Environment]::GetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', 'Process')
function git {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'clone') {
        $global:setupCloneCount++
        $testClonePath = $args[-1]
        New-Item -ItemType Directory -Force -Path $testClonePath | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $testClonePath 'LICENSE'), 'MIT License')
    } elseif ($args[0] -eq '-C' -and $args[2] -eq 'fetch') {
        if ($global:setupFetchFailures -gt 0) {
            $global:setupFetchFailures--
            $global:LASTEXITCODE = 1
        }
    } elseif ($args[0] -eq '-C' -and $args[2] -eq 'rev-parse') {
        Write-Output 'b861852dda79273bd9d2e01c3160d42e2df510d2'
    }
}
function pnpm { $global:LASTEXITCODE = 0 }
function uvx {
    if ($env:GRAPHIFY_NO_AUTO_REFRESH -ne '1') { throw 'Auto-refresh was not suppressed' }
    $global:LASTEXITCODE = 0
}
try {
    [Environment]::SetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', 'test-original', 'Process')
    $expectedFailureObserved = $false
    try { & (Join-Path $testScriptDir 'setup.ps1') } catch { $expectedFailureObserved = $true }
    if (-not $expectedFailureObserved) { throw 'Expected failed fetch was not propagated' }
    if (Test-Path -LiteralPath (Join-Path $testRoot '.code-map-tools/understand-anything')) { throw 'Incomplete source was published' }
    & (Join-Path $testScriptDir 'setup.ps1')
    if ($global:setupCloneCount -ne 2) { throw 'Retry did not provision a new isolated clone' }
    if (-not (Test-Path -LiteralPath (Join-Path $testRoot '.code-map-tools/understand-anything/LICENSE'))) { throw 'Completed checkout was not published' }
    if ([Environment]::GetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', 'Process') -ne 'test-original') { throw 'Prior environment value was not restored' }
    [Environment]::SetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', $null, 'Process')
    & (Join-Path $testScriptDir 'setup.ps1')
    if ([Environment]::GetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', 'Process')) { throw 'Originally unset environment value was not restored' }
    Write-Output 'PASS: failed fetch preserves retry; only completed checkout published; prior environment restored.'
} finally {
    [Environment]::SetEnvironmentVariable('GRAPHIFY_NO_AUTO_REFRESH', $previousAutoRefreshForTest, 'Process')
}
# Retain the fixture for inspection; never delete it automatically.
