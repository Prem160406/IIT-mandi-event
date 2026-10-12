$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$identity = [Security.Cryptography.SHA256]::Create()
try {
    $hashBytes = $identity.ComputeHash([Text.Encoding]::UTF8.GetBytes($ProjectRoot.ToLowerInvariant()))
} finally {
    $identity.Dispose()
}
$projectKey = ([BitConverter]::ToString($hashBytes)).Replace("-", "").Substring(0, 12)
$StatePath = Join-Path $env:TEMP "cardiac-risk-$projectKey-processes.json"

if (-not (Test-Path $StatePath)) {
    Write-Host "No app processes started by start.bat were recorded for this checkout."
    exit 0
}

$state = Get-Content -Raw -LiteralPath $StatePath | ConvertFrom-Json
$stopped = 0
foreach ($entry in @($state.backend, $state.frontend)) {
    try {
        $process = Get-Process -Id ([int]$entry.id) -ErrorAction Stop
        if ($process.StartTime.ToUniversalTime().Ticks -ne [long]$entry.startedAtUtcTicks) {
            continue
        }
        & taskkill.exe /PID ([int]$entry.id) /T /F 2>$null | Out-Null
        $stopped++
    } catch { }
}

Remove-Item -LiteralPath $StatePath -Force
Write-Host "Stopped $stopped app launcher process(es) started by start.bat."
