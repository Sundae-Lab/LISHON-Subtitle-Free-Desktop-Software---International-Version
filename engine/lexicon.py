import sqlite3,json,time,os,re
from pathlib import Path
from collections import OrderedDict
from contextlib import contextmanager
lookup_cache=OrderedDict()
LIMIT=2000
@contextmanager
def database():
 path=Path(os.environ.get('LISHON_LIBRARY_DIR',Path.home()/'.lishon'));path.mkdir(parents=True,exist_ok=True)
 c=sqlite3.connect(path/'library.sqlite',timeout=10);c.row_factory=sqlite3.Row
 c.executescript('''PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY,kind TEXT,term TEXT,source TEXT,target TEXT,details TEXT,created INTEGER,UNIQUE(kind,term,source,target));CREATE INDEX IF NOT EXISTS record_sort ON records(kind,term COLLATE NOCASE);CREATE INDEX IF NOT EXISTS record_time ON records(kind,created DESC);CREATE INDEX IF NOT EXISTS record_language ON records(kind,target,created DESC);CREATE INDEX IF NOT EXISTS record_group ON records(kind,source,term);CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT);''')
 if not c.execute("SELECT 1 FROM sqlite_master WHERE name='record_search'").fetchone():
  c.executescript("""CREATE VIRTUAL TABLE IF NOT EXISTS record_search USING fts5(term,details,content='records',content_rowid='id',tokenize='trigram');CREATE TRIGGER IF NOT EXISTS records_ai AFTER INSERT ON records BEGIN INSERT INTO record_search(rowid,term,details) VALUES(new.id,new.term,new.details);END;CREATE TRIGGER IF NOT EXISTS records_ad AFTER DELETE ON records BEGIN INSERT INTO record_search(record_search,rowid,term,details) VALUES('delete',old.id,old.term,old.details);END;CREATE TRIGGER IF NOT EXISTS records_au AFTER UPDATE ON records BEGIN INSERT INTO record_search(record_search,rowid,term,details) VALUES('delete',old.id,old.term,old.details);INSERT INTO record_search(rowid,term,details) VALUES(new.id,new.term,new.details);END;INSERT INTO record_search(record_search) VALUES('rebuild');""")
 try:
  with c:yield c
 finally:c.close()
def library(action='list',**args):
 with database() as c:
  if action in ['add','delete','index']:c.execute('BEGIN IMMEDIATE')
  row=c.execute("SELECT value FROM preferences WHERE key='highlight'").fetchone();enabled=bool(row and row[0]=='1')
  count=c.execute('SELECT count(*) FROM records').fetchone()[0]
  if action=='index':
   requested=bool(args.get('enabled'))
   if requested and count>LIMIT:return {'limitReached':True,'count':count,'limit':LIMIT,'remove':count-LIMIT}
   c.execute("INSERT OR REPLACE INTO preferences VALUES('highlight',?)",('1' if requested else '0',));enabled=requested
  if action=='add':
   kind=args.get('kind');term=str(args.get('term','')).strip()[:5000];source=args.get('source','en');target=args.get('target','zh')
   if kind not in ['favorite','word','sentence'] or not term:raise ValueError('无效收藏内容')
   if kind!='sentence':term=term[:100]
   duplicate=c.execute('SELECT id FROM records WHERE kind=? AND term=? AND source=? AND target=?',(kind,term,source,target)).fetchone()
   if enabled and count>=LIMIT and not duplicate:return {'limitReached':True,'count':count,'limit':LIMIT,'remove':count-LIMIT+1}
   details=json.dumps(args.get('details',{}),ensure_ascii=False)
   if len(details)>100000:raise ValueError('单条收藏内容过长')
   c.execute('INSERT INTO records(kind,term,source,target,details,created) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,term,source,target) DO UPDATE SET details=excluded.details',(kind,term,source,target,details,int(time.time()*1000)))
  if action=='delete':
   ids=list(dict.fromkeys(int(x) for x in args.get('ids',[])))[:500]
   if ids:c.execute('DELETE FROM records WHERE id IN ('+','.join('?' for _ in ids)+')',ids)
  count=c.execute('SELECT count(*) FROM records').fetchone()[0]
  terms=[r[0] for r in c.execute("SELECT DISTINCT term FROM records WHERE kind='favorite' LIMIT ?",(LIMIT,))] if enabled and count<=LIMIT else []
  if action=='terms':return terms
  query=str(args.get('query',''))[:120];kind=args.get('kind','favorite');order='term COLLATE NOCASE,id DESC' if args.get('sort')=='alpha' else 'created DESC,id DESC'
  # Parameterized queries, bounded page size, SQLite indexes; only the favorite Set reaches rendering.
  where='kind=?';params=[kind]
  if len(query)>=3:
   where+=' AND id IN (SELECT rowid FROM record_search WHERE record_search MATCH ?)';params.append(chr(34)+query.replace(chr(34),chr(34)*2)+chr(34))
  elif query:where+=' AND (instr(lower(term),lower(?))>0 OR instr(lower(details),lower(?))>0)';params += [query,query]
  languages=list(dict.fromkeys(x for x in args.get('languages',[]) if x in ['en','zh','ja','ko','fr','de','es','ru']))[:8]
  if languages:
   marks=','.join('?' for _ in languages)
   if kind=='sentence':
    where+=' AND (EXISTS (SELECT 1 FROM json_each(records.details, \'$.translations\') t WHERE json_extract(t.value, \'$.target\') IN ('+marks+')) OR (COALESCE(json_array_length(details, \'$.translations\'),0)=0 AND target IN ('+marks+')))'
    params+=languages+languages
   else:where+=' AND target IN ('+marks+')';params+=languages
  offset=max(0,int(args.get('page',0)))*50
  grouped=bool(args.get('grouped'))
  if grouped:
   # Paginate source/term groups in SQLite, so language variants cannot split across pages.
   group_order='term COLLATE NOCASE,source' if args.get('sort')=='alpha' else 'max(created) DESC,max(id) DESC'
   total=c.execute('SELECT count(*) FROM (SELECT 1 FROM records WHERE '+where+' GROUP BY source,term)',params).fetchone()[0]
   keys=c.execute('SELECT source,term FROM records WHERE '+where+' GROUP BY source,term ORDER BY '+group_order+' LIMIT 50 OFFSET ?',params+[offset]).fetchall()
   rows=[]
   if keys:
    clause=' OR '.join('(source=? AND term=?)' for _ in keys)
    members=[dict(r) for r in c.execute('SELECT * FROM records WHERE '+where+' AND ('+clause+') ORDER BY target,id',params+[v for k in keys for v in k])]
    by_key={}
    for r in members:
     r['details']=json.loads(r['details']);by_key.setdefault((r['source'],r['term']),[]).append(r)
    for k in keys:
     variants=by_key[tuple(k)];row=dict(variants[0]);row['variants']=variants;row['ids']=[v['id'] for v in variants];row['created']=max(v['created'] for v in variants);rows.append(row)
  else:
   total=c.execute('SELECT count(*) FROM records WHERE '+where,params).fetchone()[0]
   rows=[dict(r) for r in c.execute('SELECT * FROM records WHERE '+where+' ORDER BY '+order+' LIMIT 50 OFFSET ?',params+[offset])]
   for r in rows:r['details']=json.loads(r['details'])
  return {'items':rows,'total':total,'count':count,'limit':LIMIT,'highlight':enabled,'terms':terms}

def lookup(term,source='en',target='zh',translate=None):
 cache_key=(term.lower(),source,target)
 if cache_key in lookup_cache:return lookup_cache[cache_key]
 word=term.strip()[:100]
 if not word:return {'found':False,'term':term,'senses':[]}
 database_path=Path(__file__).parent/'data/dictionary.sqlite'
 c=sqlite3.connect(f'file:{database_path.as_posix()}?mode=ro',uri=True);c.row_factory=sqlite3.Row
 note='ECDICT 本地双解词典';bridge=False
 try:
  if source not in ['en','auto'] and translate:
   word=translate(word,source,'en').strip();bridge=True
  row=c.execute('SELECT * FROM words WHERE word=? COLLATE NOCASE',(word,)).fetchone()
  if not row:
   form=c.execute('SELECT word FROM forms WHERE form=? COLLATE NOCASE',(word,)).fetchone()
   if form:row=c.execute('SELECT * FROM words WHERE word=? COLLATE NOCASE',(form[0],)).fetchone()
  if not row:return {'found':False,'term':term,'senses':[],'note':'本地词典未收录此词或词组，不推测词义。'}
  field='definition' if target=='en' else 'translation'
  raw=row[field] or row['definition'] or row['translation'];raw=raw.replace('\\n','\n')
  senses=[]
  for line in raw.split('\n'):
   if not line.strip():continue
   m=re.match(r'^((?:[a-z]+\.)+)\s*(.*)',line)
   pos,meaning=(m.group(1),m.group(2)) if m else ('释义',line)
   if target not in ['en','zh'] and translate:meaning=translate(meaning,'zh' if row['translation'] else 'en',target)
   senses.append({'pos':pos,'meaning':meaning})
  supplement=c.execute('SELECT pos,definition FROM senses WHERE word=? COLLATE NOCASE ORDER BY pos, synset',(row['word'],)).fetchall()
  labels={'n':'n.','v':'v.','a':'adj.','s':'adj.','r':'adv.'}
  for sense in supplement:
   definition=sense['definition'];meaning=definition
   if target!='en' and translate:meaning=translate(definition,'en',target)
   if not any(x['meaning']==meaning for x in senses):senses.append({'pos':labels.get(sense['pos'],sense['pos']),'meaning':meaning,'original':definition,'via':'WordNet'})
  if supplement:note+=' + WordNet（补充释义经本地翻译）' if target!='en' else ' + WordNet'
  if bridge:note+=' · 经英语词头查询，请结合原句核对'
  if target not in ['en','zh']:note+=' · 释义经本地翻译'
  forms=[];labels={'p':'过去式','d':'过去分词','i':'现在分词','3':'第三人称单数','r':'比较级','t':'最高级','s':'复数','0':'原形'}
  for part in row['exchange'].split('/'):
   if ':' in part:
    k,v=part.split(':',1)
    if k in labels:forms.append({'label':labels[k],'word':v})
  result={'found':True,'term':term,'lemma':row['word'],'phonetic':row['phonetic'],'senses':senses,'forms':forms,'note':note,'source':source,'target':target}
  lookup_cache[cache_key]=result
  while len(lookup_cache)>128:lookup_cache.popitem(last=False)
  return result
 finally:c.close()
