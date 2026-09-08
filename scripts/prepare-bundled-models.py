"""Build the installer model payload from official Argos archives; cache downloads outside the project."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import time
import zipfile

import requests

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def bundle_speech(cache, catalog, output, manifest, installed=None):
    import sys
    sys.path.insert(0, str(ROOT / 'engine'))
    from model_downloads import download
    basic = ROOT / '听现Lishon-基础离线语言包.lishonpack'
    if basic.exists():
        with zipfile.ZipFile(basic) as bundle:
            for item in catalog['speech']:
                with bundle.open(item['name']) as src, (cache / item['name']).open('wb') as dst:
                    shutil.copyfileobj(src, dst)
    files = []
    speech = output / 'speech'
    speech.mkdir(parents=True, exist_ok=True)
    for item in catalog['speech']:
        source = cache / item['name']
        existing = installed / 'speech/base' / item['name'] if installed else None
        if existing and existing.is_file() and existing.stat().st_size == item['size'] and digest(existing) == item['sha256']:
            shutil.copyfile(existing, source)
        if not source.exists() or source.stat().st_size != item['size'] or digest(source) != item['sha256']:
            download(item, source, 'Preparing Whisper', lambda *args: print(*args, flush=True))
        if digest(source) != item['sha256']:
            raise ValueError('Speech checksum mismatch')
        shutil.copyfile(source, speech / item['name'])
        files.append({'path': item['name'], 'size': item['size'], 'sha256': item['sha256']})
    license_file = ROOT / 'engine/data/WHISPER-LICENSE.txt'
    shutil.copyfile(license_file, speech / 'LICENSE.txt')
    (speech / '.ready').write_text('base', encoding='utf-8')
    for name in ['LICENSE.txt', '.ready']:
        file = speech / name
        files.append({'path': name, 'size': file.stat().st_size, 'sha256': digest(file)})
    manifest['version'] = 2
    manifest['speech'] = {'files': files}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')


def prepare(cache, installed=None):
    catalog_path = ROOT / 'engine/data/model-sources.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    cache.mkdir(parents=True, exist_ok=True)
    if installed:
        # Repackage this application's verified installed models without redownloading.
        output = ROOT / 'build/bundled-models'
        manifest = {'version': 2, 'packages': []}
        for item in catalog['translation']:
            pair = item['from_code'] + '_' + item['to_code']
            folder = installed / 'translation' / pair
            metadata = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
            if metadata['from_code'] != item['from_code'] or metadata['to_code'] != item['to_code']:
                raise ValueError('Installed model language mismatch')
            files = []
            for source in folder.rglob('*'):
                relative = source.relative_to(folder).as_posix()
                if not source.is_file() or not (relative.startswith('model/') or relative in ['metadata.json','sentencepiece.model','bpe.model','README.md']):
                    continue
                dest = output / pair / relative
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
                files.append({'path': relative, 'size': dest.stat().st_size, 'sha256': digest(dest)})
            if not {'metadata.json','model/model.bin'}.issubset({f['path'] for f in files}):
                raise ValueError('Installed model incomplete')
            manifest['packages'].append({'pair': pair, 'version': item['package_version'], 'files': files})
        bundle_speech(cache, catalog, output, manifest, installed)
        return
    chunk_size = 2 * 1024 * 1024
    basic = ROOT / '听现Lishon-基础离线语言包.lishonpack'
    if basic.exists():
        with zipfile.ZipFile(basic) as bundle:
            for item in catalog['translation']:
                dest = cache / item['name']
                if not dest.exists() and item['name'] in bundle.namelist():
                    with bundle.open(item['name']) as source, dest.open('wb') as target:
                        shutil.copyfileobj(source, target)
    needed = []
    for item in catalog['translation']:
        archive = cache / item['name']
        if archive.exists() and archive.stat().st_size == item['size']:
            if not item.get('sha256') or digest(archive) == item['sha256']:
                continue
        needed.append(item)
    jobs = [(item, start, min(start + chunk_size - 1, item['size'] - 1))
            for item in needed for start in range(0, item['size'], chunk_size)]

    def fetch(job):
        item, start, end = job
        dest = cache / (item['name'] + '.' + str(start))
        if dest.exists() and dest.stat().st_size == end - start + 1:
            return
        for attempt in range(6):
            try:
                with requests.Session() as session:
                    url = item['sources'][attempt % len(item['sources'])]['url']
                    with session.get(url, stream=True, headers={'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'}, timeout=(10, 25)) as response:
                        response.raise_for_status()
                        if response.status_code != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{item["size"]}':
                            raise ValueError('Model server returned a different byte range')
                        partial = dest.with_name(dest.name + '.tmp')
                        with partial.open('wb') as stream:
                            for chunk in response.iter_content(256 * 1024):
                                stream.write(chunk)
                        if partial.stat().st_size != end - start + 1:
                            raise ValueError('Incomplete model range')
                        partial.replace(dest)
                        return
            except (requests.RequestException, ValueError):
                if attempt == 5:
                    raise
                time.sleep(.5)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for n, _ in enumerate(pool.map(fetch, jobs), 1):
            if n % 25 == 0 or n == len(jobs):
                print(f'Downloaded chunks {n}/{len(jobs)}', flush=True)
    for item in needed:
        archive = cache / item['name']
        with archive.open('wb') as stream:
            for start in range(0, item['size'], chunk_size):
                with (cache / (item['name'] + '.' + str(start))).open('rb') as chunk:
                    shutil.copyfileobj(chunk, stream)
    output = ROOT / 'build/bundled-models'
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'packages': []}
    for item in catalog['translation']:
        archive = cache / item['name']
        sha = digest(archive)
        if item.get('sha256') and item['sha256'] != sha:
            raise ValueError('Model checksum mismatch: ' + item['name'])
        item['sha256'] = sha
        pair = item['from_code'] + '_' + item['to_code']
        package = {'pair': pair, 'version': item['package_version'], 'files': []}
        with zipfile.ZipFile(archive) as z:
            if z.testzip():
                raise ValueError('Model archive CRC failed: ' + pair)
            metadata_name = next(n for n in z.namelist() if n.endswith('/metadata.json'))
            metadata = json.loads(z.read(metadata_name))
            if (metadata['from_code'], metadata['to_code']) != (item['from_code'], item['to_code']):
                raise ValueError('Model language mismatch')
            prefix = metadata_name.rsplit('/', 1)[0] + '/'
            for info in z.infolist():
                relative = info.filename.removeprefix(prefix)
                # This app uses CTranslate2 and SentencePiece directly. Stanza/PyTorch
                # sentence segmentation is unused; retain the original model and credits.
                if info.is_dir() or not (relative.startswith('model/') or relative in ['metadata.json', 'sentencepiece.model', 'bpe.model', 'README.md']):
                    continue
                dest = (output / pair / relative).resolve()
                if not dest.is_relative_to((output / pair).resolve()):
                    raise ValueError('Unsafe model path')
                dest.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info) as source, dest.open('wb') as target:
                    shutil.copyfileobj(source, target)
                package['files'].append({'path': relative, 'size': dest.stat().st_size, 'sha256': digest(dest)})
        names = {f['path'] for f in package['files']}
        if not {'metadata.json', 'model/model.bin'}.issubset(names) or not names.intersection({'sentencepiece.model', 'bpe.model'}):
            raise ValueError('Model missing runtime files: ' + pair)
        manifest['packages'].append(package)
        print('Prepared ' + pair, flush=True)
    bundle_speech(cache, catalog, output, manifest)
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Bundled bytes:', sum(f['size'] for p in manifest['packages'] for f in p['files']), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'lishon-model-cache')
    parser.add_argument('--from-installed', type=Path, help='Reuse a previously verified Lishon model directory')
    args = parser.parse_args()
    prepare(args.cache.resolve(), args.from_installed)
