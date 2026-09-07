"""Pinned model sources, resumable downloads and integrity checks. No model execution."""
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

import requests


CATALOG = json.loads((Path(__file__).parent / 'data' / 'model-sources.json').read_text(encoding='utf-8'))


def verified(path, item):
    path = Path(path)
    if not path.is_file() or path.stat().st_size != item['size']:
        return False
    if item.get('sha256'):
        with path.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest() == item['sha256']
    return True


def download(item, dest, label, progress, session_factory=requests.Session):
    """Keep a partial file across attempts; only replace the destination after validation."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if verified(dest, item):
        progress(f'{label} · 已校验，跳过重复下载', 100)
        return
    partial = dest.with_name(dest.name + '.part')
    origin = dest.with_name(dest.name + '.part.source')
    expected = item['size']
    errors = []
    with session_factory() as session:
        # Avoid the Windows application proxy for domestic CDN downloads. A system TUN
        # is outside this process's control; this does not claim to bypass a VPN.
        session.trust_env = False
        for source in item['sources']:
            url = source['url']
            if urlsplit(url).scheme != 'https':
                raise ValueError('下载源必须使用 HTTPS')
            # Do not append bytes from another source without a pinned content digest.
            if not item.get('sha256') and (not origin.exists() or origin.read_text(encoding='utf-8') != url):
                partial.unlink(missing_ok=True)
            origin.write_text(url, encoding='utf-8')
            for attempt in range(2):
                try:
                    offset = partial.stat().st_size if partial.exists() else 0
                    if offset >= expected:
                        if verified(partial, item):
                            partial.replace(dest)
                            origin.unlink(missing_ok=True)
                            return
                        partial.unlink(missing_ok=True)
                        offset = 0
                    progress(f'{label} · {source["name"]}' + (' · 断点续传' if offset else ''), round(offset * 100 / expected))
                    last = 0
                    while offset < expected:
                        headers = {'Accept-Encoding': 'identity'}
                        # Bounded requests avoid a single long-lived connection stalling
                        # a 100+ MB model. Servers without Range support still work.
                        if expected > 2 * 1024 * 1024:
                            headers['Range'] = f'bytes={offset}-{min(offset + 2 * 1024 * 1024 - 1, expected - 1)}'
                        elif offset:
                            headers['Range'] = f'bytes={offset}-'
                        with session.get(url, stream=True, headers=headers, timeout=(8, 20)) as response:
                            response.raise_for_status()
                            if urlsplit(response.url).scheme != 'https':
                                raise ValueError('下载重定向未使用 HTTPS')
                            response_end = expected
                            if response.status_code == 206:
                                match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
                                if not match or int(match[1]) != offset or int(match[3]) != expected or not offset <= int(match[2]) < expected:
                                    raise ValueError('下载续传范围异常')
                                response_end = int(match[2]) + 1
                            elif response.status_code == 200:
                                offset = 0  # Server ignored Range: never append a full response.
                            else:
                                raise ValueError('下载响应异常')
                            done = offset
                            with partial.open('ab' if offset else 'wb') as stream:
                                for chunk in response.iter_content(256 * 1024):
                                    done += len(chunk)
                                    if done > response_end:
                                        raise ValueError('下载文件尺寸与内置目录不符')
                                    stream.write(chunk)
                                    if time.monotonic() - last > .5:
                                        progress(f'{label} · {source["name"]} · {done / 1048576:.1f} MB', min(99, round(done * 100 / expected)))
                                        last = time.monotonic()
                            if done != response_end:
                                raise ValueError('下载分段未完成')
                            offset = done
                    if not verified(partial, item):
                        if partial.stat().st_size >= expected:
                            partial.unlink(missing_ok=True)
                        raise ValueError('下载未完成或文件校验不通过')
                    partial.replace(dest)
                    origin.unlink(missing_ok=True)
                    progress(f'{label} · 校验完成', 100)
                    return
                except (requests.RequestException, ValueError) as exc:
                    errors.append(f'{source["name"]}：{type(exc).__name__}')
                    progress(f'{label} · 当前来源暂不可用，正在重试或切换备用源')
        raise ValueError(f'{label}失败。已尝试：' + '、'.join(dict.fromkeys(errors)) + '。已保留下载进度，请稍后重试，或使用「导入离线包」。')
