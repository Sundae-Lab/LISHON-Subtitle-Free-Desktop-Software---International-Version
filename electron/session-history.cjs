const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const INDEX='.lishon-history.json';
function atomic(file,value){const temporary=file+'.tmp';fs.writeFileSync(temporary,value);fs.renameSync(temporary,file);}
function regular(root,file){const base=path.resolve(root),target=path.resolve(file);if(target!==base&&!target.startsWith(base+path.sep))throw Error('Invalid history path');let p=target;while(p){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('History directory cannot contain links');const parent=path.dirname(p);if(parent===p)break;p=parent;}return target;}
function createHistory({now=Date.now,onChange=()=>{},onError=()=>{},name=n=>'历史记录'+n}={}){
 let root='',enabled=false,index={version:1,next:1,items:[]};const sessions=new Map();
 function load(directory){regular(directory,directory);fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,INDEX);if(!fs.existsSync(file))atomic(file,JSON.stringify({version:1,next:1,items:[]}));const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.version!==1||!Array.isArray(value.items)||!Number.isSafeInteger(value.next))throw Error('Invalid history index');return value;}
 function file(row){if(!/^lishon-[a-f0-9-]+\.(md|jsonl)$/.test(row.file))throw Error('Invalid history filename');return regular(root,path.join(root,row.file));}
 function writeIndex(){atomic(regular(root,path.join(root,INDEX)),JSON.stringify(index));onChange();}
 function duration(s){return s.elapsed+(s.running?now()-s.since:0);}
 function flush(s){if(!enabled||!root||duration(s)<=15000||!s.lines.length)return;
  if(!s.row){const n=index.next++;s.row={id:randomUUID(),name:name(n),number:n,origin:s.origin,created:new Date(s.started).toISOString(),preview:'',file:''};s.row.file='lishon-'+s.row.id+'.jsonl';index.items.unshift(s.row);}
  s.row.preview=s.lines.map(x=>x.text+' '+x.translations.map(y=>y.translation).join(' ')).join(' ').slice(0,220);s.row.duration=Math.round(duration(s)/1000);
  const body=[...(!s.written?[JSON.stringify({version:2,name:s.row.name,created:s.row.created,origin:s.origin})]:[]),...s.lines.map(line=>JSON.stringify(line))].join('\n');
  if(s.written)fs.appendFileSync(file(s.row),'\n'+body);else atomic(file(s.row),body);s.written=true;s.lines=[];writeIndex();
 }
 const guard=fn=>{try{return fn();}catch(e){onError(e);}};
 function end(origin){const s=sessions.get(origin);if(s){try{guard(()=>flush(s));}finally{sessions.delete(origin);}}}
 return {
  configure(directory,on){if(directory!==root||on!==enabled){const loaded=directory===root?index:directory?load(directory):{version:1,next:1,items:[]};for(const origin of [...sessions.keys()])end(origin);root=directory||'';enabled=!!on&&!!root;index=loaded;}return this.list();},
  begin(origin){if(!enabled||sessions.has(origin))return;sessions.set(origin,{origin,started:now(),since:now(),elapsed:0,running:true,lines:[]});},
  pause(origin,paused){const s=sessions.get(origin);if(!s)return;if(paused&&s.running){s.elapsed+=now()-s.since;s.running=false;guard(()=>flush(s));}else if(!paused&&!s.running){s.since=now();s.running=true;}},
  add(origin,item){const s=sessions.get(origin);if(!s||!s.running||!item.text?.trim())return;s.lines.push({time:new Date(now()).toLocaleTimeString('en-GB'),text:String(item.text),source:item.source||'auto',translations:(item.translations?.length?item.translations:[{target:item.target||'',translation:item.translation||''}]).map(x=>({target:x.target,translation:String(x.translation||'')}))});flush(s);},
  tick(){for(const s of sessions.values())guard(()=>flush(s));},end,
  close(){for(const origin of [...sessions.keys()])guard(()=>end(origin));},
  list(){return {directory:root,enabled,items:index.items.filter(x=>root&&fs.existsSync(file(x))).map(x=>({...x}))};},
  resolve(id){const row=index.items.find(x=>x.id===id);if(!row)throw Error('History record not found');return file(row);},
  read(id){const row=index.items.find(x=>x.id===id);if(!row)throw Error('History record not found');const body=fs.readFileSync(file(row),'utf8');let entries=[];
   if(row.file.endsWith('.jsonl')){entries=body.split('\n').slice(1).filter(x=>x.trim()).map(line=>JSON.parse(line));}
   else {for(const block of body.split('\n---\n')){const lines=block.split('\n');const start=lines.findIndex(line=>/^\*\*\d{2}:\d{2}/.test(line));if(start<0)continue;const parts=lines.slice(start+1).filter(x=>x.trim());const translations=[],original=[];for(const part of parts){const m=/^([a-z]{2}): (.*)$/.exec(part);if(m)translations.push({target:m[1],translation:m[2]});else original.push(part);}entries.push({source:'auto',text:original.join('\n'),translations});}}
   return {...row,entries:entries.filter(x=>typeof x.text==='string'&&Array.isArray(x.translations)).map(x=>({time:x.time||'',source:x.source||'auto',text:x.text,translations:x.translations.filter(y=>typeof y.translation==='string').map(y=>({target:y.target||'auto',translation:y.translation}))}))};},
  rename(id,title){title=String(title||'').trim().replace(/[\r\n\0]/g,' ').slice(0,100);if(!title)throw Error('A name is required');const row=index.items.find(x=>x.id===id);if(!row)throw Error('History record not found');const f=file(row);let body=fs.readFileSync(f,'utf8');if(row.file.endsWith('.jsonl')){const lines=body.split('\n');lines[0]=JSON.stringify({...JSON.parse(lines[0]),name:title});body=lines.join('\n');}else body=body.replace(/^#[^\n]*/,()=> '# '+title);atomic(f,body);row.name=title;writeIndex();return this.list();},
  remove(ids){const wanted=new Set(ids);const rows=index.items.filter(x=>wanted.has(x.id));for(const row of rows){const f=file(row);if(fs.existsSync(f))fs.unlinkSync(f);index.items=index.items.filter(x=>x.id!==row.id);for(const s of sessions.values())if(s.row?.id===row.id){sessions.delete(s.origin);}writeIndex();}return this.list();}
 };
}
module.exports={createHistory,regular};
