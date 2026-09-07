$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
foreach ($required in @('node_modules\electron', '.venv\Scripts\python.exe', 'native\publish\Lingua.Native.exe', 'engine\data\dictionary.sqlite')) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Missing $required. Run scripts/restore-dev.ps1 first." }
}
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:LINGUA_DEV_URL -ErrorAction SilentlyContinue
npm run desktop
