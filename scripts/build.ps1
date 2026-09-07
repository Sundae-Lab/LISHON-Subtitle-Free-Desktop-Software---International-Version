$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
uv venv .venv --python 3.11
uv pip install --python .venv\Scripts\python.exe -r engine\requirements-lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
.venv\Scripts\python.exe scripts\prepare-bundled-models.py
if ($LASTEXITCODE -ne 0) { throw 'Bundled model preparation failed' }
node scripts/compress-models.cjs
if ($LASTEXITCODE -ne 0) { throw 'Bundled model compression failed' }
$env:ELECTRON_BUILDER_NSIS_DIR = .venv\Scripts\python.exe scripts/prepare-installer-tool.py
if ($LASTEXITCODE -ne 0) { throw 'Installer compiler preparation failed' }
dotnet publish native\Lingua.Native.csproj -c Release -r win-x64 --self-contained true -o native\publish
if ($LASTEXITCODE -ne 0) { throw 'Native build failed' }
.venv\Scripts\python.exe scripts\prepare-data.py
if ($LASTEXITCODE -ne 0) { throw 'Dictionary build failed' }
.venv\Scripts\python.exe -m PyInstaller --noconfirm engine\lingua-engine.spec --distpath engine\dist --workpath engine\build
if ($LASTEXITCODE -ne 0) { throw 'Engine build failed' }
& "$PSScriptRoot\build-icons.ps1"
npm run package
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }
$packageMetadata = Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json
$installerName = $packageMetadata.build.nsis.artifactName.Replace('${version}', $packageMetadata.version).Replace('${arch}', 'x64').Replace('${ext}', 'exe')
Copy-Item -LiteralPath (Join-Path 'release' $installerName) -Destination (Join-Path (Get-Location).Path $installerName) -Force
Write-Host "Installer ready: $installerName"
