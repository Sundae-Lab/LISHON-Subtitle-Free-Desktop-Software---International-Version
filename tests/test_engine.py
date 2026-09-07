import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
spec=importlib.util.spec_from_file_location('service',Path(__file__).parents[1]/'engine/service.py')
service=importlib.util.module_from_spec(spec)
sys.argv=[sys.argv[0],str(Path(__file__).parents[1]/'.qa/test-models')]
spec.loader.exec_module(service)

class EngineTests(unittest.TestCase):
 def test_zip_traversal_rejected(self):
  archive=io.BytesIO()
  with zipfile.ZipFile(archive,'w') as z:z.writestr('../escape.txt','no')
  archive.seek(0)
  with tempfile.TemporaryDirectory() as folder:
   with self.assertRaises(ValueError):service.safe_extract(archive,Path(folder))
 def test_input_limit(self):
  with self.assertRaises(ValueError):service.translate('x'*5001,'en','zh')
 def test_missing_model_is_error_not_fake_translation(self):
  with self.assertRaisesRegex(ValueError,'直译包'):service.translate('Hello','en','zh')
 def test_detection(self):
  for text,code in [('你好','zh'),('hello','en'),('こんにちは','ja'),('안녕하세요','ko'),('Привет','ru')]:self.assertEqual(service.detect(text),code)
 def test_three_languages_translate_directly_and_preserve_order(self):
  calls=[]
  def fake(text,source,target):
   calls.append((source,target));return target+':'+text
  with patch.object(service,'translate_direct',side_effect=fake):
   result=service.translate('你好','zh','ja',['ja','fr','zh'])
  self.assertEqual([r['target'] for r in result['translations']],['ja','fr','zh'])
  self.assertEqual(calls,[('zh','ja'),('zh','fr')])
  self.assertEqual(result['translations'][0]['translation'],'ja:你好')
  self.assertEqual(result['translations'][1]['translation'],'fr:你好')
  self.assertEqual(result['translations'][-1]['translation'],'你好')
 def test_context_hints_keep_offsets_and_respect_conflicting_cues(self):
  from context_terms import enrich
  text='The mouse needs new batteries.';changed,mapping=enrich(text,'en')
  self.assertIn('computer mouse',changed);self.assertEqual(text[mapping[changed.index('computer')][0]:mapping[changed.index('computer')][1]],'mouse')
  animal='The mouse ate cheese near the laptop.';self.assertEqual(enrich(animal,'en')[0],animal)
  finance='The bank approved the loan near the river.';self.assertEqual(enrich(finance,'en')[0],finance)
 def test_reject_more_than_three_targets(self):
  with self.assertRaises(ValueError):service.translate('hello','en','zh',['zh','ja','fr','de'])
if __name__=='__main__':unittest.main(argv=[sys.argv[0]])
