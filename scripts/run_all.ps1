# Starts the API (port 8000) in a new window and the frontend dev server (port 5173) here.
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$py = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }
Start-Process -FilePath $py -ArgumentList "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $Root
Set-Location (Join-Path $Root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npm run dev
