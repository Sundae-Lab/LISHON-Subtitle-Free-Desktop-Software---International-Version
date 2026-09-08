export function historyGroups(entries=[]){
 const sources=new Map(),translations=new Map();
 entries.forEach((entry,index)=>{const code=entry.source||'auto';if(!sources.has(code))sources.set(code,[]);sources.get(code).push({text:entry.text,number:index+1});for(const item of entry.translations||[]){if(!translations.has(item.target))translations.set(item.target,[]);translations.get(item.target).push({text:item.translation,number:index+1});}});
 const group=(original)=>([code,rows])=>({code,original,texts:rows.map(x=>x.text),numbers:rows.map(x=>x.number)});
 return [...sources].map(group(true)).concat([...translations].map(group(false)));
}
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=s=>String(s??'').replace(/[\\`*_[\]<>#]/g,'\\$&').replace(/\r?\n/g,'  \n');
export function historyExport(doc,{mode='paired',format='md',label=code=>code==='auto'?'Original':code,original='Original',showLabels=true}={}){
 const groups=mode==='grouped'?historyGroups(doc.entries):null;
 const marker=text=>showLabels?['<span style="color:#808080">'+html(text)+'</span>','']:[];
 if(format==='md')return ['# '+md(doc.name),'',...(groups?groups.flatMap(g=>[...marker(label(g.code)+(g.original?' · '+original:'')),...g.texts.flatMap((text,i)=>[(showLabels?'**'+g.numbers[i]+'** · ':'')+md(text),'']),'---','']):doc.entries.flatMap((entry,i)=>[...(showLabels?['## '+(i+1),'']:[]),...marker(label(entry.source||'auto')),md(entry.text),'',...entry.translations.flatMap(x=>[...marker(label(x.target)),md(x.translation),'']),'---','']))].join('\n');
 const paragraph=text=>'<p>'+html(text).replace(/\n/g,'<br>')+'</p>';
 const heading=(tag,text)=>showLabels?'<'+tag+' class="language-label">'+html(text)+'</'+tag+'>':'';
 const body=groups?groups.map(g=>'<section>'+heading('h2',label(g.code)+(g.original?' · '+original:''))+g.texts.map((text,i)=>paragraph((showLabels?g.numbers[i]+' · ':'')+text)).join('')+'</section>').join(''):doc.entries.map((entry,i)=>'<section>'+(showLabels?'<h2>'+String(i+1)+'</h2>':'')+heading('h3',label(entry.source||'auto'))+paragraph(entry.text)+entry.translations.map(x=>heading('h3',label(x.target))+paragraph(x.translation)).join('')+'</section>').join('');
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>@page{size:A4;margin:20mm 22mm}*{box-sizing:border-box;color:#000!important}.language-label{color:#808080!important}html,body{background:#fff!important}body{margin:0;font:12pt/1.8 "Segoe UI","Microsoft YaHei UI",sans-serif}h1{font-size:24pt;line-height:1.3;margin:0 0 28pt;overflow-wrap:anywhere}h2{font-size:15pt;margin:22pt 0 10pt;break-after:avoid}h3{font-size:10pt;font-weight:600;margin:14pt 0 4pt;break-after:avoid}p{margin:0 0 12pt;white-space:normal;overflow-wrap:anywhere;orphans:3;widows:3}section{padding-bottom:14pt;border-bottom:1px solid #ddd}</style></head><body><h1>'+html(doc.name)+'</h1>'+body+'</body></html>';
}
