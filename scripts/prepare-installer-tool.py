"""Pinned NSISBI compiler: preserves NSIS UI and supports the complete offline payload."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import zipfile
import requests

URL = 'https://downloads.sourceforge.net/project/nsisbi/nsisbi3.12.2/nsisbi-3.12.2-amd64.zip'
SHA256 = '0935e1fbf1283bc3e0bcbdaf798696afb4575ae1e6253d677069f9abc63045f1'
folder = Path(os.environ['LOCALAPPDATA']) / 'LishonBuild/nsisbi-3.12.2'
if not (folder / '.verified').exists():
    folder.mkdir(parents=True, exist_ok=True)
    archive = folder / 'compiler.zip'
    response = requests.get(URL, timeout=(15, 120))
    response.raise_for_status()
    if hashlib.sha256(response.content).hexdigest() != SHA256:
        raise ValueError('Installer compiler checksum mismatch')
    archive.write_bytes(response.content)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if not (folder / item.filename).resolve().is_relative_to(folder.resolve()):
                raise ValueError('Unsafe compiler archive')
        z.extractall(folder)
    # Keep the existing x86 Unicode plugin ABI; applications remain x64.
    (folder / 'nsisconf.nsh').write_text('Target x86-unicode\nSetCompressorNumThreads 4\n', encoding='utf-8')
    (folder / '.verified').write_text(SHA256, encoding='ascii')
# This helper is provided by electron-builder and only used if it needs elevation.
elevate = next((Path(os.environ['LOCALAPPDATA']) / 'electron-builder/Cache/nsis-3.0.4.1').rglob('elevate.exe'), None)
if elevate is None:
    clean_env = dict(os.environ)
    clean_env.pop('ELECTRON_BUILDER_NSIS_DIR', None)
    result = subprocess.run(['node', '-e', "require('app-builder-lib/out/toolsets/windows').getNsisElevatePath().then(console.log)"], cwd=Path(__file__).resolve().parents[1], env=clean_env, capture_output=True, text=True, check=True)
    elevate = Path(result.stdout.strip().splitlines()[-1])
shutil.copyfile(elevate, folder / 'elevate.exe')
print(folder)
