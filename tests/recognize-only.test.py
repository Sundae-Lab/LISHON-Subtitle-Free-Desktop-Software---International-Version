"""Exercise the actual transcribe function with a deterministic recognizer, without model downloads."""
import ast
import io
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import patch
from contextlib import nullcontext
import time

class RecognitionOnly(TestCase):
    def test_translation_is_skipped_only_when_requested(self):
        tree = ast.parse((Path(__file__).parents[1] / 'engine/service.py').read_text(encoding='utf-8'))
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'transcribe')
        calls, events = [], []
        class Root:
            def __truediv__(self, other): return self
            def exists(self): return True
        class Recognizer:
            def transcribe(self, audio, **kwargs):
                calls.append(kwargs)
                return [SimpleNamespace(text=' Please keep an eye on it. 谢谢。 ', start=1, end=4)], SimpleNamespace(language='en')
        def local(*args):
            calls.append('local')
            return {'text':args[0], 'translation':'本地译文'}
        env = dict(speech_models=SimpleNamespace(ready=lambda: True), whisper=Recognizer(), ROOT=Root(), time=time, io=io, inference_lock=nullcontext(), translate=local, emit=events.append)
        exec(compile(ast.Module(body=[function],type_ignores=[]), 'transcribe', 'exec'),env)
        with patch.dict('sys.modules', {'faster_whisper':SimpleNamespace(WhisperModel=Recognizer)}):
            result=env['transcribe']({'path':'fixture.wav','source':'auto','recognizeOnly':True})
            self.assertNotIn('local',calls)
            self.assertIsNone(calls[0]['language'])
            self.assertNotIn('translation',result['segments'][0])
            self.assertEqual(result['segments'][0]['start'],1)
            self.assertEqual(events,[])
            env['transcribe']({'path':'fixture.wav','source':'en'})
            self.assertIn('local',calls)
            self.assertEqual(events[0]['segment']['translation'],'本地译文')

if __name__ == '__main__': main()
