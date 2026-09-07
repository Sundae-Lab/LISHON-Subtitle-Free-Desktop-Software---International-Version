param(
    [Parameter(Mandatory=$true)][string]$SourceRoot,
    [string]$DestinationRoot,
    [string]$DestinationFile,
    [string]$LogPath
)
$ErrorActionPreference = 'Stop'
function Get-BundledFileHash([string]$FilePath) {
    # NSIS can launch PowerShell without its script-module search path.
    $stream = [IO.File]::OpenRead($FilePath)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '') }
    finally { $hasher.Dispose(); $stream.Dispose() }
}
trap {
    if ($LogPath) { [IO.Directory]::CreateDirectory((Split-Path -Parent $LogPath)) | Out-Null; [IO.File]::WriteAllText($LogPath, $_.ToString()) }
    Write-Error $_ -ErrorAction Continue
    exit 1
}
if ($DestinationFile) { $DestinationRoot = [IO.File]::ReadAllText($DestinationFile, [Text.Encoding]::Unicode).Trim([char]0xFEFF).Trim() }
if (-not $DestinationRoot) { throw 'No model directory selected' }
$sourceBase = [IO.Path]::GetFullPath($SourceRoot).TrimEnd('\')
$targetBase = [IO.Path]::GetFullPath($DestinationRoot)
if (-not [IO.Path]::IsPathRooted($DestinationRoot)) { throw 'Model directory must be absolute' }
$manifest = Get-Content -LiteralPath (Join-Path $sourceBase 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne 2 -or @($manifest.packages).Count -ne 14) { throw 'Invalid bundled model manifest' }
$speechSource = Join-Path $sourceBase 'speech'
$speechFiles = @($manifest.speech.files)
$speechRequired = @('config.json','model.bin','tokenizer.json','vocabulary.txt')
foreach ($required in $speechRequired) { if (@($speechFiles | Where-Object path -eq $required).Count -ne 1) { throw 'Incomplete bundled speech manifest' } }
foreach ($file in $speechFiles) {
    if ($file.path -notin @('config.json','model.bin','tokenizer.json','vocabulary.txt','LICENSE.txt','.ready')) { throw 'Unsafe speech file path' }
    $source = Join-Path $speechSource $file.path
    if ((Get-Item -LiteralPath $source).Length -ne $file.size -or (Get-BundledFileHash $source) -ne $file.sha256) { throw 'Bundled speech integrity check failed' }
}
$seen = @{}
foreach ($package in $manifest.packages) {
    $pair = [string]$package.pair
    if ($pair -notmatch '^(en_(zh|ja|ko|fr|de|es|ru)|(zh|ja|ko|fr|de|es|ru)_en)$' -or $seen.ContainsKey($pair)) { throw 'Invalid bundled model direction' }
    $seen[$pair] = $true
    $prefix = [IO.Path]::GetFullPath((Join-Path $sourceBase $pair)) + '\'
    $paths = @{}
    foreach ($file in $package.files) {
        $relative = [string]$file.path
        $resolved = [IO.Path]::GetFullPath((Join-Path $prefix $relative))
        if (-not $resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or $paths.ContainsKey($resolved)) { throw 'Unsafe bundled model path' }
        $paths[$resolved] = $true
        $item = Get-Item -LiteralPath $resolved
        if ($item.Length -ne $file.size -or (Get-BundledFileHash $resolved) -ne $file.sha256) { throw "Model integrity check failed: $pair" }
    }
    foreach ($required in @('metadata.json','model/model.bin')) {
        if (-not ($package.files.path -contains $required)) { throw "Missing required model file: $pair" }
    }
    if (-not (($package.files.path -contains 'sentencepiece.model') -or ($package.files.path -contains 'bpe.model'))) { throw 'Missing tokenizer' }
}
New-Item -ItemType Directory -Path $targetBase -Force | Out-Null
# Do not follow a pre-existing per-package junction when moving models.
$translationRoot = Join-Path $targetBase 'translation'
New-Item -ItemType Directory -Path $translationRoot -Force | Out-Null
foreach ($directory in @($targetBase, $translationRoot)) {
    if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Please choose a regular model directory' }
}
foreach ($package in $manifest.packages) {
    $pair = [string]$package.pair
    $destination = Join-Path $translationRoot $pair
    if (Test-Path -LiteralPath $destination) {
        if ((Get-Item -LiteralPath $destination).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Model folder cannot be a junction' }
        $complete = $false
        try {
            $meta = Get-Content -LiteralPath (Join-Path $destination 'metadata.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            $complete = ($meta.from_code + '_' + $meta.to_code) -eq $pair
            foreach ($required in @('model/model.bin')) {
                $complete = $complete -and ((Get-Item -LiteralPath (Join-Path $destination $required)).Length -gt 0)
            }
            $tokenizer = @('sentencepiece.model','bpe.model') | Where-Object { $candidate = Join-Path $destination $_; (Test-Path -LiteralPath $candidate) -and (Get-Item -LiteralPath $candidate).Length -gt 0 }
            $complete = $complete -and @($tokenizer).Count -gt 0
        } catch { $complete = $false }
        if ($complete) { Write-Output "Preserved $pair"; continue }
    }
    $staging = Join-Path $translationRoot ('.install-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    foreach ($file in $package.files) {
        $target = Join-Path $staging $file.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path (Join-Path $sourceBase $pair) $file.path) -Destination $target
        if ((Get-BundledFileHash $target) -ne $file.sha256) { throw 'Copied model failed integrity check' }
    }
    $backup = $null
    if (Test-Path -LiteralPath $destination) {
        $backups = Join-Path $targetBase 'backups'
        New-Item -ItemType Directory -Path $backups -Force | Out-Null
        if ((Get-Item -LiteralPath $backups).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup folder cannot be a junction' }
        $backup = Join-Path $backups ($pair + '_installer_' + [guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $destination -Destination $backup
    }
    try { Move-Item -LiteralPath $staging -Destination $destination }
    catch {
        if ($backup -and -not (Test-Path -LiteralPath $destination)) { Move-Item -LiteralPath $backup -Destination $destination }
        throw
    }
    Write-Output "Installed $pair"
}
$speechParent = Join-Path $targetBase 'speech'
$speechDestination = Join-Path $speechParent 'base'
New-Item -ItemType Directory -Path $speechParent -Force | Out-Null
foreach ($directory in @($speechParent,$speechDestination)) {
    if ((Test-Path -LiteralPath $directory) -and ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Speech folder cannot be a junction' }
}
$speechComplete = $true
foreach ($file in $speechFiles | Where-Object { $_.path -in $speechRequired }) {
    $target = Join-Path $speechDestination $file.path
    if (!(Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -ne $file.size -or (Get-BundledFileHash $target) -ne $file.sha256) { $speechComplete = $false; break }
}
if (!$speechComplete) {
    $staging = Join-Path $speechParent ('.install-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    foreach ($file in $speechFiles) {
        $target = Join-Path $staging $file.path
        Copy-Item -LiteralPath (Join-Path $speechSource $file.path) -Destination $target
        if ((Get-BundledFileHash $target) -ne $file.sha256) { throw 'Copied speech integrity check failed' }
    }
    $backup = $null
    if (Test-Path -LiteralPath $speechDestination) {
        $backup = Join-Path $speechParent ('base-backup-' + [guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $speechDestination -Destination $backup
    }
    try { Move-Item -LiteralPath $staging -Destination $speechDestination }
    catch { if ($backup) { Move-Item -LiteralPath $backup -Destination $speechDestination }; throw }
    Write-Output 'Installed speech/base'
} else { Write-Output 'Preserved speech/base' }
if ($LogPath) { [IO.Directory]::CreateDirectory((Split-Path -Parent $LogPath)) | Out-Null; [IO.File]::WriteAllText($LogPath, 'OK: 14 translation directions and Whisper speech verified in ' + $targetBase) }
