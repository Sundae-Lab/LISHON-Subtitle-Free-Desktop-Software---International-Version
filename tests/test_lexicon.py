import os,sys,tempfile,unittest,time,json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
import lexicon
class LibraryTests(unittest.TestCase):
 def setUp(self):
  self.folder=tempfile.TemporaryDirectory();self.env=patch.dict(os.environ,{'LISHON_LIBRARY_DIR':self.folder.name});self.env.start()
 def tearDown(self):self.env.stop();self.folder.cleanup()
 def add(self,term,kind='favorite'):
  return lexicon.library('add',kind=kind,term=term,details={'senses':[{'pos':'n.','meaning':'测试 '+term}]})
 def test_persistence_search_sort_and_bulk_delete(self):
  self.add('zebra');self.add('apple');self.add('A sentence.','sentence')
  self.assertEqual([r['term'] for r in lexicon.library(sort='alpha')['items']],['apple','zebra'])
  found=lexicon.library(query='apple')['items'];self.assertEqual(len(found),1)
  self.assertEqual(len(lexicon.library(query='测试')['items']),2)
  lexicon.library('delete',ids=[found[0]['id']]);self.assertEqual(lexicon.library(query='apple')['total'],0)
  self.assertEqual(lexicon.library(kind='sentence')['items'][0]['term'],'A sentence.')
 def test_limit_disable_continue_reenable_and_cleanup(self):
  with patch.object(lexicon,'LIMIT',3):
   lexicon.library('index',enabled=True)
   for word in ['one','two','three']:self.add(word)
   self.assertTrue(self.add('four')['limitReached'])
   lexicon.library('index',enabled=False);self.add('four')
   self.assertEqual(lexicon.library('index',enabled=True)['remove'],1)
   item=lexicon.library(query='four')['items'][0];lexicon.library('delete',ids=[item['id']])
   self.assertTrue(lexicon.library('index',enabled=True)['highlight'])
   self.assertEqual(len(lexicon.library('terms')),3)
 def test_all_available_parts_of_speech_and_forms(self):
  entry=lexicon.lookup('bank','en','en')
  self.assertTrue(entry['found']);self.assertIn('v.',[r['pos'] for r in entry['senses']]);self.assertIn('n.',[r['pos'] for r in entry['senses']]);self.assertTrue(entry['forms'])
 def test_language_groups_keep_variants_together_across_pages(self):
  for i in range(52):
   for target in ['zh','ja']:
    lexicon.library('add',kind='favorite',term=f'word{i:02d}',source='en',target=target,details={'senses':[{'pos':'n.','meaning':target}]})
  page=lexicon.library(grouped=True,sort='alpha')
  self.assertEqual(page['total'],52);self.assertEqual(len(page['items']),50)
  self.assertTrue(all(len(r['variants'])==2 and len(r['ids'])==2 for r in page['items']))
  second=lexicon.library(grouped=True,sort='alpha',page=1);self.assertEqual(len(second['items']),2)
  filtered=lexicon.library(grouped=True,languages=['ja']);self.assertTrue(all([v['target'] for v in r['variants']]==['ja'] for r in filtered['items']))
  lexicon.library('delete',ids=page['items'][0]['ids']);self.assertEqual(lexicon.library(grouped=True)['total'],51)
 def test_sentence_language_filter_reads_embedded_translations_and_legacy(self):
  lexicon.library('add',kind='sentence',term='Hello.',source='en',target='zh',details={'translations':[{'target':'zh','translation':'你好'},{'target':'ja','translation':'こんにちは'}]})
  lexicon.library('add',kind='sentence',term='Good morning.',source='en',target='ja',details={'translations':[],'translation':'おはよう'})
  self.assertEqual(lexicon.library(kind='sentence',languages=['ja'],grouped=True)['total'],2)
  self.assertEqual(lexicon.library(kind='sentence',languages=['zh'],grouped=True)['total'],1)
  self.assertEqual(lexicon.library(kind='sentence',languages=['fr'],grouped=True)['total'],0)
if __name__=='__main__':unittest.main()
