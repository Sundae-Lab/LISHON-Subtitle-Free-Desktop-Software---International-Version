import hashlib
from pathlib import Path
import sys
import tempfile
from unittest import TestCase, main
sys.path.insert(0, str(Path(__file__).parents[1] / 'engine'))
from speech_models import SpeechModels

class SpeechModelRecovery(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.legacy = self.root / 'legacy'
        self.current = self.root / 'chosen'
        self.files = []
        for name in ['config.json','model.bin','tokenizer.json','vocabulary.txt']:
            data = (name + ' fixture').encode()
            file = self.legacy / 'speech/base' / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
            self.files.append(dict(name=name,size=len(data),sha256=hashlib.sha256(data).hexdigest()))

    def test_recover_old_folder_offline_preserving_source(self):
        model=SpeechModels(self.current,self.files,self.legacy)
        self.assertTrue(model.ready())
        self.assertTrue(model.ready())
        for item in self.files:
            self.assertEqual((model.folder/item['name']).read_bytes(),(self.legacy/'speech/base'/item['name']).read_bytes())

    def test_marker_alone_never_means_ready_and_missing_marker_is_ok(self):
        folder=self.current/'speech/base'
        folder.mkdir(parents=True)
        (folder/'.ready').write_text('base')
        self.assertFalse(SpeechModels(self.current,self.files).ready())
        self.assertTrue(SpeechModels(self.legacy,self.files).ready())

    def test_same_size_corruption_is_detected_and_backed_up(self):
        model=SpeechModels(self.current,self.files,self.legacy)
        self.assertTrue(model.ready())
        file=model.folder/'model.bin'
        file.write_bytes(b'x'*file.stat().st_size)
        self.assertFalse(SpeechModels(self.current,self.files).ready())
        self.assertTrue(model.ready())
        self.assertEqual(len(list(model.folder.parent.glob('base-backup-*'))),1)

if __name__=='__main__':main()
