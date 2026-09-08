param([Parameter(Mandatory=$true)][string]$InstallationRoot,[Parameter(Mandatory=$true)][string]$UserDataRoot,[int]$DeleteHistory=0,[int]$DeleteModels=0)
$ErrorActionPreference='Stop'
function Read-Record([string]$file){if(Test-Path -LiteralPath $file){return Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json};return $null}
function Safe-Path([string]$root,[string]$relative){
 if(-not [IO.Path]::IsPathRooted($root) -or [IO.Path]::IsPathRooted($relative) -or $relative -match '(^|[\\/])\.\.([\\/]|$)' -or $relative.Contains(':')){throw 'Unsafe data path'}
 $base=[IO.Path]::GetFullPath($root).TrimEnd('\');$target=[IO.Path]::GetFullPath((Join-Path $base $relative));if(-not $target.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Data path leaves its directory'}
 $current=$target
 while($current){if((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Refusing to follow a data link'};$parent=[IO.Path]::GetDirectoryName($current);if($parent -eq $current){break};$current=$parent}
 return $target
}
try{
 $locations=Read-Record (Join-Path $UserDataRoot 'data-locations.json')
 $installed=Read-Record (Join-Path $InstallationRoot 'lishon-model-location.json')
 $files=New-Object 'System.Collections.Generic.List[string]'
 if($DeleteHistory -eq 1){
  foreach($root in @($locations.histories | Select-Object -Unique)){
   if(-not $root){continue};$indexFile=Safe-Path $root '.lishon-history.json';$index=Read-Record $indexFile
   if($index -and $index.version -eq 1){foreach($row in $index.items){if($row.file -notmatch '^lishon-[a-f0-9-]+\.(md|jsonl)$'){throw 'Invalid history inventory'};$files.Add((Safe-Path $root $row.file))};$files.Add($indexFile)}
  }
  $files.Add((Safe-Path $UserDataRoot 'history.json'))
 }
 if($DeleteModels -eq 1){
  foreach($root in @(@($locations.models)+@($installed.modelPath) | Where-Object {$_} | Select-Object -Unique)){
   $recordFile=Safe-Path $root '.lishon-model-files.json';$record=Read-Record $recordFile
   if(-not $record){continue};if($record.version -ne 1){throw 'Invalid model inventory'}
   foreach($relative in $record.files){if($relative -notmatch '^(translation[\\/](en_(zh|ja|ko|fr|de|es|ru)|(zh|ja|ko|fr|de|es|ru)_en)[\\/]|speech[\\/]base[\\/])'){throw 'Invalid model inventory path'};$files.Add((Safe-Path $root $relative))};$files.Add($recordFile)
  }
 }
 # Resolve every exact file first. Do not recursively delete a chosen storage root.
 foreach($file in ($files | Select-Object -Unique)){if([IO.File]::Exists($file)){[IO.File]::Delete($file)}}
 Write-Output 'Selected Lishon data files removed; unrelated files preserved.'
}catch{Write-Error $_ -ErrorAction Continue;exit 1}
