$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$stage=Join-Path $env:TEMP ('lishon-opt-data-'+[guid]::NewGuid().ToString('N'))
foreach($historyChoice in @(0,1)){foreach($modelChoice in @(0,1)){
 $root=Join-Path $stage "$historyChoice-$modelChoice"
 $user=Join-Path $root 'user';$appDir=Join-Path $root '软件';$models=$appDir;$histories=Join-Path $appDir 'Lishon-History'
 foreach($dir in @($user,$appDir,$histories,(Join-Path $models 'translation/en_zh/model'),(Join-Path $models 'speech/base'))){New-Item -ItemType Directory -Path $dir -Force | Out-Null}
 $model=Join-Path $models 'translation/en_zh/model/model.bin';$speech=Join-Path $models 'speech/base/model.bin';$history=Join-Path $histories 'lishon-abcdef.md';$unrelated=Join-Path $models 'personal.txt'
 $structuredHistory=Join-Path $histories 'lishon-fedcba.jsonl'
 foreach($file in @($model,$speech,$history,$structuredHistory,$unrelated)){[IO.File]::WriteAllText($file,'fixture')}
 @{version=1;models=@($models);histories=@($histories)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $user 'data-locations.json') -Encoding UTF8
 @{version=1;modelPath=$models} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $appDir 'lishon-model-location.json') -Encoding UTF8
 @{version=1;files=@('translation/en_zh/model/model.bin','speech/base/model.bin')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $models '.lishon-model-files.json') -Encoding UTF8
 @{version=1;items=@(@{file='lishon-abcdef.md'},@{file='lishon-fedcba.jsonl'})} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $histories '.lishon-history.json') -Encoding UTF8
 & (Join-Path $project 'build/remove-optional-data.ps1') -InstallationRoot $appDir -UserDataRoot $user -DeleteHistory $historyChoice -DeleteModels $modelChoice
 if((Test-Path -LiteralPath $model) -eq [bool]$modelChoice){throw 'Model checkbox behavior incorrect'}
 if((Test-Path -LiteralPath $speech) -eq [bool]$modelChoice){throw 'Speech checkbox behavior incorrect'}
 if((Test-Path -LiteralPath $history) -eq [bool]$historyChoice){throw 'History checkbox behavior incorrect'}
 if((Test-Path -LiteralPath $structuredHistory) -eq [bool]$historyChoice){throw 'Structured history checkbox behavior incorrect'}
 if(-not(Test-Path -LiteralPath $unrelated)){throw 'Unrelated file deleted'}
}}
Write-Output 'PASS: all four uninstall choices preserve unrelated files, including same-directory storage.'
