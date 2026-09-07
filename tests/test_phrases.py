import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
from context_terms import enrich
class PhraseTests(unittest.TestCase):
 def test_idiom_and_alignment(self):
  text='We broke the ice with a joke at the meeting.'
  result,mapping=enrich(text,'en')
  self.assertIn('made people feel relaxed',result)
  start=result.index('made people feel relaxed')
  self.assertEqual(mapping[start],(3,16))
  self.assertEqual(len(result),len(mapping))
 def test_literal_ice_is_unchanged(self):
  text='The ship broke the ice in the frozen lake.'
  self.assertEqual(enrich(text,'en')[0],text)
 def test_longest_connector_and_non_english(self):
  text='Despite the fact that it rained, we continued.'
  self.assertTrue(enrich(text,'en')[0].startswith('although'))
  self.assertEqual(enrich(text,'de')[0],text)
