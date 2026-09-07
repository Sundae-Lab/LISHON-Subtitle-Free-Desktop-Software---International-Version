param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$dataDirectory=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'lishon-international'
$selectedDirectory=Join-Path $dataDirectory 'models'
$configuration=Join-Path $dataDirectory 'settings.json'
if(Test-Path -LiteralPath $configuration){
 try {
  $settings=Get-Content -LiteralPath $configuration -Raw -Encoding UTF8|ConvertFrom-Json
  if($settings.modelPath -and [IO.Path]::IsPathRooted($settings.modelPath)){$selectedDirectory=$settings.modelPath}
 }catch{}
}
[IO.File]::WriteAllText($OutputPath,$selectedDirectory,[Text.Encoding]::Unicode)
