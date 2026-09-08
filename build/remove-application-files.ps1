param([Parameter(Mandatory=$true)][string]$InstallationRoot)
$ErrorActionPreference = 'Stop'
try {
    $root = [IO.Path]::GetFullPath($InstallationRoot).TrimEnd('\')
    if (-not [IO.Path]::IsPathRooted($InstallationRoot) -or $root.Length -lt 3) { throw 'Invalid installation path' }
    $prefix = $root + '\'
    $manifest = Get-Content -LiteralPath (Join-Path $root 'lishon-install-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -ne 1 -or @($manifest.files).Count -lt 1) { throw 'Missing application file inventory' }
    function Resolve-OwnedPath([string]$relative) {
        if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':') -or $relative -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Unsafe application inventory path' }
        $target = [IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Path leaves the installation directory' }
        # Reject junctions/symlinks anywhere between the installation root and each owned file.
        $current = $target
        while ($current.Length -ge $root.Length) {
            if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Application path contains a junction or symbolic link' }
            if ($current -eq $root) { break }
            $current = [IO.Path]::GetDirectoryName($current)
        }
        return $target
    }
    # Resolve every entry before removing anything. Never recursively remove an installation folder.
    $files = @($manifest.files | ForEach-Object { Resolve-OwnedPath $_ })
    $directories = @($manifest.directories | ForEach-Object { Resolve-OwnedPath $_ })
    foreach ($file in $files) {
        if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) }
    }
    foreach ($directory in ($directories | Sort-Object Length -Descending)) {
        if ([IO.Directory]::Exists($directory) -and [IO.Directory]::GetFileSystemEntries($directory).Count -eq 0) { [IO.Directory]::Delete($directory,$false) }
    }
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
