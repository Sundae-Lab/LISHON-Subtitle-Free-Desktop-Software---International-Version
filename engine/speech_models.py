"""Validate actual Whisper files and recover a previously downloaded local pack."""
import hashlib
import os
from pathlib import Path
import shutil
import threading
import uuid


class SpeechModels:
    def __init__(self, root, entries, legacy_root=None):
        self.folder = Path(root) / 'speech' / 'base'
        self.entries = entries
        self.legacy = Path(legacy_root) / 'speech' / 'base' if legacy_root else None
        self.lock = threading.RLock()
        self.cached = None

    def valid(self, folder):
        try:
            for item in self.entries:
                file = folder / item['name']
                if file.stat().st_size != item['size']:
                    return False
                with file.open('rb') as stream:
                    if hashlib.file_digest(stream, 'sha256').hexdigest() != item['sha256']:
                        return False
            return True
        except OSError:
            return False

    def ready(self):
        with self.lock:
            try:
                fingerprint = tuple((f.stat().st_size, f.stat().st_mtime_ns) for f in [self.folder / item['name'] for item in self.entries])
            except OSError:
                fingerprint = None
            if fingerprint is not None and fingerprint == self.cached:
                return True
            if fingerprint is not None and self.valid(self.folder):
                self.cached = fingerprint
                return True
            # Recover only this application's known old model directory. Never download.
            if not self.legacy or self.legacy.resolve() == self.folder.resolve() or not self.valid(self.legacy):
                return False
            parent = self.folder.parent
            parent.mkdir(parents=True, exist_ok=True)
            if parent.is_symlink() or self.folder.is_symlink():
                return False
            staging = parent / ('.recover-' + uuid.uuid4().hex)
            staging.mkdir()
            for item in self.entries:
                shutil.copyfile(self.legacy / item['name'], staging / item['name'])
            if not self.valid(staging):
                raise ValueError('旧目录语音模型复制校验失败，原模型已保留')
            (staging / '.ready').write_text('base', encoding='utf-8')
            backup = None
            if self.folder.exists():
                backup = parent / ('base-backup-' + uuid.uuid4().hex)
                self.folder.rename(backup)
            try:
                staging.rename(self.folder)
            except OSError:
                if backup:
                    backup.rename(self.folder)
                raise
            return self.ready()
