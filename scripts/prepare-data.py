"""Restore pinned public dictionary sources; never downloads translation models."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = json.loads((ROOT / 'engine/data/dictionary-sources.json').read_text(encoding='utf-8'))


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(name, destination):
    source = SOURCES[name]
    print(f'Downloading {name} from its pinned upstream source...', flush=True)
    request = urllib.request.Request(source['url'], headers={'User-Agent': 'Lishon-source-setup/0.6'})
    with urllib.request.urlopen(request, timeout=120) as response, destination.open('wb') as output:
        shutil.copyfileobj(response, output)
    if digest(destination) != source['sha256']:
        raise RuntimeError(f'{name}: SHA-256 mismatch; downloaded data was not installed.')


def prepare(data, rebuild=False):
    data.mkdir(parents=True, exist_ok=True)
    csv = data / 'ecdict.csv'
    with tempfile.TemporaryDirectory(prefix='lishon-dictionary-') as temporary:
        temp = Path(temporary)
        if not csv.exists() or digest(csv) != SOURCES['ecdict']['sha256']:
            fetched = temp / 'ecdict.csv'
            download('ecdict', fetched)
            shutil.copy2(fetched, csv)
        # A stamp only skips the network after this script has installed a verified archive.
        stamp = data / 'wordnet/.lishon-source-sha256'
        verified = stamp.exists() and stamp.read_text().strip() == SOURCES['wordnet']['sha256']
        verified = verified and all((data / 'wordnet' / name).is_file() for name in
                                   ['LICENSE', 'data.noun', 'data.verb', 'index.noun', 'index.verb'])
        if not verified:
            archive = temp / 'wordnet.zip'
            download('wordnet', archive)
            with zipfile.ZipFile(archive) as package:
                for info in package.infolist():
                    parts = PurePosixPath(info.filename).parts
                    if not parts or parts[0] != 'wordnet' or '..' in parts or '\\' in info.filename:
                        raise RuntimeError('Unexpected archive path; nothing outside the data directory is allowed.')
                    if info.is_dir():
                        continue
                    target = data.joinpath(*parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with package.open(info) as source, target.open('wb') as output:
                        shutil.copyfileobj(source, output)
            stamp.write_text(SOURCES['wordnet']['sha256'], encoding='utf-8')
        shutil.copy2(data / 'wordnet/LICENSE', data / 'WORDNET-LICENSE.txt')
    if rebuild or not (data / 'dictionary.sqlite').is_file():
        subprocess.run([sys.executable, str(ROOT / 'scripts/build-dictionary.py'), '--data-dir', str(data)], check=True)
    print('Dictionary ready. Translation and speech models are managed separately in the app.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'engine/data')
    parser.add_argument('--rebuild', action='store_true')
    args = parser.parse_args()
    try:
        prepare(args.data_dir.resolve(), args.rebuild)
    except Exception as error:
        print(f'Dictionary setup failed: {error}\nCheck your connection to the URLs in engine/data/dictionary-sources.json and retry.', file=sys.stderr)
        sys.exit(1)
