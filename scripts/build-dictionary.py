import argparse,csv,sqlite3,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--data-dir',type=Path,default=root/'engine/data')
data=parser.parse_args().data_dir.resolve()
out=data/'dictionary.sqlite.building'
if out.exists():out.unlink()
c=sqlite3.connect(out)
c.executescript("CREATE TABLE IF NOT EXISTS words(word TEXT PRIMARY KEY COLLATE NOCASE,phonetic TEXT,definition TEXT,translation TEXT,exchange TEXT);CREATE TABLE IF NOT EXISTS forms(form TEXT PRIMARY KEY COLLATE NOCASE,word TEXT);")
with (data/'ecdict.csv').open(encoding='utf-8') as f:
 for row in csv.DictReader(f):
  c.execute('INSERT OR REPLACE INTO words VALUES(?,?,?,?,?)',[row[k] for k in ['word','phonetic','definition','translation','exchange']])
  for pair in row['exchange'].split('/'):
   if ':' not in pair:continue
   kind,value=pair.split(':',1)
   if kind=='0':c.execute('INSERT OR IGNORE INTO forms VALUES(?,?)',(row['word'],value))
   elif kind in ['p','d','i','3','r','t','s']:
    for value in value.split(','):c.execute('INSERT OR IGNORE INTO forms VALUES(?,?)',(value,row['word']))
import os
os.environ['NLTK_DATA']=str(data)
from nltk.corpus.reader import WordNetCorpusReader
class LocalWordNet30(WordNetCorpusReader):
 # Only English 3.0 senses are indexed; no OMW/cross-version mapping or global NLTK corpus is needed.
 def map_wn(self,version='wordnet'):
  if version=='wordnet' and self.get_version()=='3.0':return None
  return super().map_wn(version)
wn=LocalWordNet30(str(data/'wordnet'),None)
c.execute('CREATE TABLE IF NOT EXISTS senses(word TEXT COLLATE NOCASE,synset TEXT,pos TEXT,definition TEXT,PRIMARY KEY(word,synset))')
for syn in wn.all_synsets():
 for lemma in syn.lemma_names():c.execute('INSERT OR REPLACE INTO senses VALUES(?,?,?,?)',(lemma.replace('_',' '),syn.name(),syn.pos(),syn.definition()))
(data/'WORDNET-LICENSE.txt').write_text((data/'wordnet/LICENSE').read_text(),encoding='utf-8')
c.commit();print({'dictionaryEntries':c.execute('SELECT COUNT(*) FROM words').fetchone()[0]});c.close()
out.replace(data/'dictionary.sqlite')
