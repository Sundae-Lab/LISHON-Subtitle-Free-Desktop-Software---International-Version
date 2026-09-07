import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'engine'))
from model_downloads import download
import requests


DATA = b'valid model payload'
ITEM = {'size': len(DATA), 'sha256': hashlib.sha256(DATA).hexdigest(), 'sources': [
    {'name': 'primary', 'url': 'https://primary.example/model'},
    {'name': 'backup', 'url': 'https://backup.example/model'}]}


class Response:
    def __init__(self, content=DATA, status=200, headers=None, fail=False):
        self.content, self.status_code, self.headers, self.fail = content, status, headers or {}, fail
        self.url = 'https://cdn.example/model'
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def raise_for_status(self): pass
    def iter_content(self, size):
        yield self.content
        if self.fail: raise requests.ConnectionError('network disconnected')


class Session:
    def __init__(self, responses): self.responses, self.calls = list(responses), []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def get(self, url, **kwargs):
        self.calls.append((url, kwargs['headers']))
        response = self.responses.pop(0)
        if isinstance(response, Exception): raise response
        return response


class Downloads(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dest = Path(self.temp.name) / 'model.bin'
    def run_download(self, session, item=ITEM):
        download(item, self.dest, 'model', lambda *args: None, lambda: session)
    def test_domestic_failure_falls_back(self):
        session = Session([requests.Timeout(), requests.Timeout(), Response()])
        self.run_download(session)
        self.assertIn('backup.example', session.calls[-1][0])
        self.assertEqual(self.dest.read_bytes(), DATA)
    def test_interrupted_download_resumes_at_correct_offset(self):
        session = Session([Response(DATA[:5], fail=True), Response(DATA[5:], 206, {'Content-Range': f'bytes 5-{len(DATA)-1}/{len(DATA)}'})])
        self.run_download(session)
        self.assertEqual(session.calls[1][1]['Range'], 'bytes=5-')
        self.assertEqual(self.dest.read_bytes(), DATA)
    def test_server_ignoring_range_restarts_without_duplicates(self):
        self.dest.with_name('model.bin.part').write_bytes(DATA[:5])
        session = Session([Response()])
        self.run_download(session)
        self.assertEqual(self.dest.read_bytes(), DATA)
    def test_corrupt_payload_is_not_committed(self):
        session = Session([Response(b'x'*len(DATA)) for _ in range(4)])
        with self.assertRaisesRegex(ValueError, '导入离线包'): self.run_download(session)
        self.assertFalse(self.dest.exists())
    def test_invalid_resume_range_is_rejected(self):
        self.dest.with_name('model.bin.part').write_bytes(DATA[:5])
        session = Session([Response(DATA, 206, {'Content-Range': f'bytes 0-{len(DATA)-1}/{len(DATA)}'}) for _ in range(4)])
        with self.assertRaises(ValueError): self.run_download(session)
        self.assertFalse(self.dest.exists())
    def test_verified_download_makes_no_request(self):
        self.dest.write_bytes(DATA)
        session = Session([])
        self.run_download(session)
        self.assertEqual(session.calls, [])
    def test_http_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            self.run_download(Session([]), {**ITEM, 'sources': [{'name':'bad', 'url':'http://bad.example'}]})
    def test_unhashed_model_does_not_mix_source_bytes(self):
        session = Session([Response(DATA[:5], fail=True), requests.Timeout(), Response()])
        self.run_download(session, {k:v for k,v in ITEM.items() if k != 'sha256'})
        self.assertNotIn('Range', session.calls[-1][1])
        self.assertEqual(self.dest.read_bytes(), DATA)
    def test_large_model_download_uses_bounded_ranges(self):
        size = 2 * 1024 * 1024
        payload = b'x' * size + b'last chunk'
        item = {**ITEM, 'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
        session = Session([
            Response(payload[:size], 206, {'Content-Range': f'bytes 0-{size-1}/{len(payload)}'}),
            Response(payload[size:], 206, {'Content-Range': f'bytes {size}-{len(payload)-1}/{len(payload)}'})])
        self.run_download(session, item)
        self.assertEqual(session.calls[0][1]['Range'], f'bytes=0-{size-1}')
        self.assertEqual(session.calls[1][1]['Range'], f'bytes={size}-{len(payload)-1}')
        self.assertEqual(self.dest.read_bytes(), payload)


if __name__ == '__main__': unittest.main()
