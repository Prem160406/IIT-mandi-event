$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendRoot = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path (Join-Path $FrontendRoot "package.json"))) {
    throw "Frontend files are missing. Merge or check out the frontend branch first."
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js, then reopen this window and retry."
}

$identity = [Security.Cryptography.SHA256]::Create()
try {
    $hashBytes = $identity.ComputeHash([Text.Encoding]::UTF8.GetBytes($ProjectRoot.ToLowerInvariant()))
} finally {
    $identity.Dispose()
}
$projectKey = ([BitConverter]::ToString($hashBytes)).Replace("-", "").Substring(0, 12)
$StatePath = Join-Path $env:TEMP "cardiac-risk-$projectKey-processes.json"

if (Test-Path $StatePath) {
    $state = Get-Content -Raw -LiteralPath $StatePath | ConvertFrom-Json
    $alive = @()
    foreach ($entry in @($state.backend, $state.frontend)) {
        try {
            $process = Get-Process -Id ([int]$entry.id) -ErrorAction Stop
            if ($process.StartTime.ToUniversalTime().Ticks -eq [long]$entry.startedAtUtcTicks) {
                $alive += $true
            }
        } catch { }
    }
    if ($alive.Count -gt 0) {
        Write-Host "A launcher window is already running for this checkout. Use stop.bat before starting it again."
        exit 1
    }
    Remove-Item -LiteralPath $StatePath -Force
}

$PythonPath = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonPath)) {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python) { throw "Python was not found. Install Python or create the project's .venv first." }
    $PythonPath = $python.Source
}
& $PythonPath -c "import uvicorn" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "The selected Python environment is missing the backend dependencies. Install them with: python -m pip install -r requirements.txt"
}

if (-not (Test-Path (Join-Path $FrontendRoot "node_modules"))) {
    Write-Host "Installing frontend dependencies from package-lock.json..."
    Push-Location $FrontendRoot
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
}

$processes = @{}
try {
    $apiCommand = "title Cardiac Risk API && `"$PythonPath`" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"
    $apiProcess = Start-Process -FilePath $env:ComSpec -ArgumentList @("/k", $apiCommand) -WorkingDirectory $ProjectRoot -PassThru
    $processes.backend = @{ id = $apiProcess.Id; startedAtUtcTicks = $apiProcess.StartTime.ToUniversalTime().Ticks }

    $frontendCommand = "title Cardiac Risk Frontend && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
    $frontendProcess = Start-Process -FilePath $env:ComSpec -ArgumentList @("/k", $frontendCommand) -WorkingDirectory $FrontendRoot -PassThru
    $processes.frontend = @{ id = $frontendProcess.Id; startedAtUtcTicks = $frontendProcess.StartTime.ToUniversalTime().Ticks }

    $processes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StatePath -Encoding UTF8
} catch {
    foreach ($entry in $processes.Values) {
        & taskkill.exe /PID ([int]$entry.id) /T /F 2>$null | Out-Null
    }
    if (Test-Path $StatePath) { Remove-Item -LiteralPath $StatePath -Force }
    throw
}

Write-Host "Started the API at http://127.0.0.1:8000 and frontend at http://127.0.0.1:5173."
Write-Host "Use stop.bat to close the two app windows started for this checkout."
