$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Split-Path -Parent $PSScriptRoot
$iconSource = [System.Drawing.Image]::FromFile((Join-Path $iconRoot 'build\lishon-icon.png'))
$iconEntries = [System.Collections.Generic.List[byte[]]]::new()
$iconSizes = @(16,24,32,48,64,128,256)
try {
  foreach ($iconSize in $iconSizes) {
    $iconBitmap = [System.Drawing.Bitmap]::new($iconSize,$iconSize,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
    $iconStream = [System.IO.MemoryStream]::new()
    try {
      $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $iconGraphics.DrawImage($iconSource,0,0,$iconSize,$iconSize)
      $iconBitmap.Save($iconStream,[System.Drawing.Imaging.ImageFormat]::Png)
      $iconEntries.Add($iconStream.ToArray())
    } finally { $iconStream.Dispose(); $iconGraphics.Dispose(); $iconBitmap.Dispose() }
  }
  $iconFile = [System.IO.File]::Create((Join-Path $iconRoot 'build\icon.ico'))
  $iconWriter = [System.IO.BinaryWriter]::new($iconFile)
  try {
    $iconWriter.Write([uint16]0); $iconWriter.Write([uint16]1); $iconWriter.Write([uint16]$iconSizes.Count)
    $iconOffset = 6 + 16 * $iconSizes.Count
    for ($iconIndex=0; $iconIndex -lt $iconSizes.Count; $iconIndex++) {
      $iconDimension = if ($iconSizes[$iconIndex] -eq 256) {0} else {$iconSizes[$iconIndex]}
      $iconWriter.Write([byte]$iconDimension); $iconWriter.Write([byte]$iconDimension)
      $iconWriter.Write([byte]0); $iconWriter.Write([byte]0); $iconWriter.Write([uint16]1); $iconWriter.Write([uint16]32)
      $iconWriter.Write([uint32]$iconEntries[$iconIndex].Length); $iconWriter.Write([uint32]$iconOffset)
      $iconOffset += $iconEntries[$iconIndex].Length
    }
    foreach ($iconEntry in $iconEntries) { $iconWriter.Write($iconEntry) }
  } finally { $iconWriter.Dispose(); $iconFile.Dispose() }
} finally { $iconSource.Dispose() }
