$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $env:TEMP ('lishon-installer-test-' + [guid]::NewGuid().ToString('N'))
$source = Join-Path $testRoot 'payload'
$destination = Join-Path $testRoot 'chosen models'
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) 'build\install-bundled-models.ps1'
$packages = @()
foreach ($code in @('zh','ja','ko','fr','de','es','ru')) {
    foreach ($pair in @("en_$code", "${code}_en")) {
        $parts = $pair.Split('_')
        $files = @()
        $values = @{'metadata.json'=(@{from_code=$parts[0];to_code=$parts[1]}|ConvertTo-Json);'sentencepiece.model'='fixture';'model/model.bin'='fixture';'model/config.json'='{}'}
        if ($pair -eq 'en_ja') { $values.Remove('model/config.json') }
        if ($pair -eq 'es_en') { $values.Remove('sentencepiece.model'); $values['bpe.model']='fixture bpe' }
        foreach ($relative in $values.Keys) {
            $file = Join-Path (Join-Path $source $pair) $relative
            New-Item -ItemType Directory -Path (Split-Path -Parent $file) -Force | Out-Null
            [IO.File]::WriteAllText($file, $values[$relative])
            $files += @{path=$relative;size=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file).Hash}
        }
        $packages += @{pair=$pair;files=$files}
    }
}
$speechFiles=@()
foreach($name in @('config.json','model.bin','tokenizer.json','vocabulary.txt','.ready')) {
    $file=Join-Path $source ('speech\'+$name)
    New-Item -ItemType Directory -Path (Split-Path -Parent $file) -Force | Out-Null
    [IO.File]::WriteAllText($file,'speech fixture')
    $speechFiles+=@{path=$name;size=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file).Hash}
}
$manifest = @{version=2;packages=$packages;speech=@{files=$speechFiles}}
$manifestPath = Join-Path $source 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$chosenFile = Join-Path $testRoot 'chosen.txt'
[IO.File]::WriteAllText($chosenFile, $destination, [Text.Encoding]::Unicode)
& $installer -SourceRoot $source -DestinationFile $chosenFile | Out-Null
if (@(Get-ChildItem -LiteralPath (Join-Path $destination 'translation') -Directory).Count -ne 14) {throw 'Missing installed language direction'}
if (!(Test-Path -LiteralPath (Join-Path $destination 'speech\base\model.bin'))) {throw 'Missing installed speech model'}
$custom = Join-Path $destination 'translation\en_zh\model\model.bin'
[IO.File]::WriteAllText($custom,'existing customized model')
& $installer -SourceRoot $source -DestinationRoot $destination | Out-Null
if ([IO.File]::ReadAllText($custom) -ne 'existing customized model') {throw 'Upgrade overwrote existing model'}
# An incomplete pre-existing package is backed up before installing a complete replacement.
$incomplete = Join-Path $destination 'translation\ja_en\model\model.bin'
[IO.File]::WriteAllText($incomplete,'')
& $installer -SourceRoot $source -DestinationRoot $destination | Out-Null
if ((Get-Item -LiteralPath $incomplete).Length -eq 0 -or -not (Get-ChildItem -LiteralPath (Join-Path $destination 'backups') -Directory)) {throw 'Incomplete model recovery failed'}
$speechDamaged=Join-Path $destination 'speech\base\model.bin'
[IO.File]::WriteAllText($speechDamaged,'truncated')
& $installer -SourceRoot $source -DestinationRoot $destination | Out-Null
if ([IO.File]::ReadAllText($speechDamaged) -ne 'speech fixture') {throw 'Speech corruption was not repaired'}
# The installer host may have no PowerShell script-module search path.
$modulePathBefore = $env:PSModulePath
try {
    $env:PSModulePath = ''
    & "$PSHOME\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installer -SourceRoot $source -DestinationFile $chosenFile -LogPath (Join-Path $testRoot 'isolated.log') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Installer depends on external PowerShell modules' }
} finally { $env:PSModulePath = $modulePathBefore }
$badSource = Join-Path $source 'en_zh\model\model.bin'
[IO.File]::WriteAllText($badSource,'tampered payload')
$childLog = Join-Path $testRoot 'rejected.log'
$ErrorActionPreference = 'Continue'
& "$PSHOME\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installer -SourceRoot $source -DestinationRoot (Join-Path $testRoot 'must not install') -LogPath $childLog 2>$null | Out-Null
$ErrorActionPreference = 'Stop'
$blocked = $LASTEXITCODE -eq 1 -and (Test-Path -LiteralPath $childLog)
if (-not $blocked -or (Test-Path -LiteralPath (Join-Path $testRoot 'must not install'))) {throw 'Tampered model was not rejected before installation'}
Write-Output 'PASS 14 directions, chosen directory, preserve existing models, recover incomplete model, reject corrupt payload before writes'
Write-Output "Fixture: $testRoot"

