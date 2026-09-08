$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$stage=Join-Path $env:TEMP ('lishon-cleanup-'+[guid]::NewGuid().ToString('N'))
foreach($mode in @('same','nested','separate')) {
    $appDir=Join-Path $stage ($mode+' 应用')
    $modelDir=if($mode -eq 'same'){$appDir}elseif($mode -eq 'nested'){Join-Path $appDir '模型 文件'}else{Join-Path $stage 'separate 模型'}
    foreach($folder in @((Join-Path $appDir 'resources/engine'),(Join-Path $modelDir 'translation/en_zh'),(Join-Path $modelDir 'speech/base'))) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    [IO.File]::WriteAllText((Join-Path $appDir 'app.exe'),'software')
    [IO.File]::WriteAllText((Join-Path $appDir 'resources/engine/runtime.dll'),'runtime')
    [IO.File]::WriteAllText((Join-Path $appDir 'personal.txt'),'keep user file')
    [IO.File]::WriteAllText((Join-Path $modelDir 'translation/en_zh/model.bin'),'keep model')
    [IO.File]::WriteAllText((Join-Path $modelDir 'speech/base/model.bin'),'keep speech')
    $manifest=@{version=1;files=@('app.exe','resources/engine/runtime.dll','lishon-install-files.json');directories=@('resources','resources/engine')}
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $appDir 'lishon-install-files.json') -Encoding UTF8
    & (Join-Path $project 'build/remove-application-files.ps1') -InstallationRoot $appDir
    foreach($file in @('app.exe','resources/engine/runtime.dll')) {if(Test-Path -LiteralPath (Join-Path $appDir $file)){throw 'Application file was not removed'}}
    foreach($file in @((Join-Path $appDir 'personal.txt'),(Join-Path $modelDir 'translation/en_zh/model.bin'),(Join-Path $modelDir 'speech/base/model.bin'))) {if(-not(Test-Path -LiteralPath $file)){throw 'Cleanup deleted user/model data'}}
}
Write-Output "PASS same, nested and separate model paths preserve models and user files; evidence: $stage"
