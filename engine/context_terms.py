"""Conservative domain hints for ambiguous English nouns, with reversible offsets.

Hints only activate with explicit surrounding domain vocabulary. They enrich model
input, never overwrite the source text or dictionary definitions shown to the user.
"""
import re,json
from pathlib import Path
PHRASE_HINTS=json.loads((Path(__file__).parent/"data/phrase-hints.json").read_text(encoding="utf-8"))
PHRASE_PATTERN=re.compile(r"(?<!\w)(?:"+"|".join(re.escape(p) for p in sorted(PHRASE_HINTS,key=len,reverse=True))+r")(?!\w)",re.I)
RULES=[
 ('mouse','computer mouse',r'computer|laptop|keyboard|cursor|click|batter(?:y|ies)|usb|wireless',r'cheese|rodent|trap|animal'),
 ('bank','riverbank',r'river|stream|shore|riverbed',r'loan|money|account|deposit|finance|cash'),
 ('crane','construction crane',r'steel|beam|construction|building|cargo',r'bird|feather|wing'),
 ('cell','biological cell',r'tissue|biology|dna|organism|membrane',r'prison|jail|phone|battery'),
 ('port','computer port',r'usb|hdmi|ethernet|serial|connector',r'harbor|harbour|ship|wine'),
 ('bug','software defect',r'software|debug|compiler|source code|programming|application',r'insect|beetle|garden'),
 ('thread','software thread',r'cpu|concurrency|mutex|multithread|processor',r'needle|sewing|cotton'),
 ('plant','industrial plant',r'manufacturing|factory|workers|shutdown',r'leaf|leaves|soil|seed|flower'),
]
def enrich(text,source):
 if source!='en':return text,[(i,i+1) for i in range(len(text))]
 replacements=[]
 for match in PHRASE_PATTERN.finditer(text):
  hint,cues=PHRASE_HINTS[match.group().lower()]
  context=text[max(0,match.start()-160):match.end()+160]
  if not cues or re.search(r"\b(?:"+cues+r")\b",context,re.I):replacements.append((match.start(),match.end(),hint))
 for word,hint,cues,blockers in RULES:
  for match in re.finditer(r'\b'+word+r'\b',text,re.I):
   context=text[max(0,match.start()-180):match.end()+180]
   if hint.lower() in context.lower():continue
   if re.search(r'\b(?:'+cues+r')\b',context,re.I) and not re.search(r'\b(?:'+blockers+r')\b',context,re.I):replacements.append((match.start(),match.end(),hint))
 parts=[];mapping=[];cursor=0
 for start,end,hint in sorted(replacements):
  if start<cursor:continue
  parts.append(text[cursor:start]);mapping.extend((i,i+1) for i in range(cursor,start))
  parts.append(hint);mapping.extend([(start,end)]*len(hint));cursor=end
 parts.append(text[cursor:]);mapping.extend((i,i+1) for i in range(cursor,len(text)))
 return ''.join(parts),mapping
