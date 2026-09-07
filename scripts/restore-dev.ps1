$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Node dependency installation failed' }
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    uv venv .venv --python 3.11
    if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed' }
}
uv pip install --python .venv\Scripts\python.exe -r engine\requirements-lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
.venv\Scripts\python.exe scripts\prepare-data.py
if ($LASTEXITCODE -ne 0) { throw 'Dictionary preparation failed' }
dotnet publish native\Lingua.Native.csproj -c Release -r win-x64 --self-contained true -o native\publish
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Write-Host 'Development environment restored. Run npm run desktop to open the app.'
