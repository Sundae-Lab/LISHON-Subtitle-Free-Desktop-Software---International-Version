const fs=require('node:fs'),path=require('node:path');
const providers=require('./ai-providers.json');
const agent=fs.readFileSync(path.join(__dirname,'translation-agent.txt'),'utf8');
const languages={en:'English',zh:'简体中文',ja:'日本語',ko:'한국어',fr:'Français',de:'Deutsch',es:'Español',ru:'Русский'};
function normalize(config){
 const provider=providers.find(p=>p.id===config.provider);if(!provider)throw new Error('请选择 AI 服务商');
 let url;try{url=new URL(String(config.baseUrl||provider.baseUrl).trim());}catch{throw new Error('请填写正确的 API 服务地址');}
 if(url.username||url.password||url.search||url.hash)throw new Error('服务地址不能包含密钥、查询参数或账号');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('远程 API 服务地址必须使用 HTTPS');
 const model=String(config.model||'').trim();if(!model||model.length>150||/[\r\n]/.test(model))throw new Error('请填写有效的模型名称');
 let baseUrl=url.href.replace(/\/+$/,'').replace(/\/(chat\/completions|messages)$/,'');
 return {provider:provider.id,baseUrl,model,enabled:config.enabled===true,context:config.context!==false,quality:config.quality==='precise'?'precise':'realtime'};
}
function buildRequest(config,key,input){
 const provider=providers.find(p=>p.id===config.provider);
 const user=JSON.stringify({sourceHint:input.source||'auto',targets:input.targets.map(code=>({code,name:languages[code]})),previousContext:input.context||[],currentText:input.text,...(input.draftTranslations?{task:'review-against-original',draftTranslations:input.draftTranslations}: {})});
 const headers={'Content-Type':'application/json'};
 if(provider.protocol==='anthropic')return {url:config.baseUrl+'/messages',headers:{...headers,'x-api-key':key,'anthropic-version':'2023-06-01'},body:{model:config.model,max_tokens:8192,system:agent,messages:[{role:'user',content:user}]}};
 const body={model:config.model,messages:[{role:'system',content:agent},{role:'user',content:user}],stream:false};
 if(['deepseek','openai','qwen','kimi','gemini'].includes(config.provider))body.response_format={type:'json_object'};
 if(config.provider==='deepseek')body.temperature=0.1;
 if(config.provider==='gemini')body.reasoning_effort='low';
 if(config.provider==='qwen')body.enable_thinking=false;
 if(config.provider==='kimi'||config.provider==='deepseek')body.thinking={type:'disabled'};
 return {url:config.baseUrl+'/chat/completions',headers:{...headers,Authorization:'Bearer '+key},body};
}
function parseResponse(data,config,input){
 const claude=config.provider==='claude';
 if((claude&&data.stop_reason==='max_tokens')||(!claude&&data.choices?.[0]?.finish_reason==='length'))throw new Error('AI 返回的译文被截断，请缩短原文或更换模型');
 let content=claude?data.content?.filter(x=>x.type==='text').map(x=>x.text).join(''):data.choices?.[0]?.message?.content;
 if(typeof content!=='string')throw new Error('AI 未返回译文，请检查模型是否支持文本翻译');
 let result;try{result=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new Error('AI 返回格式不正确，请重试或更换模型');}
 if(!result||typeof result!=='object'||!Array.isArray(result.translations)||result.translations.length!==input.targets.length)throw new Error('AI 未完整返回所有目标语种，请重试');
 const translations=input.targets.map(target=>{const matches=result.translations.filter(x=>x&&x.target===target);if(matches.length!==1||typeof matches[0].translation!=='string'||!matches[0].translation.trim()||matches[0].translation.length>30000)throw new Error('AI 返回的译文不完整，请重试');return {target,translation:matches[0].translation,alignment:[]};});
 const detectedLanguages=Array.isArray(result.detectedLanguages)?[...new Set(result.detectedLanguages.filter(x=>typeof x==='string'&&/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(x)))].slice(0,12):[];
 return {text:input.text,source:detectedLanguages.find(x=>languages[x])||(languages[input.source]?input.source:'en'),target:input.targets[0],translation:translations[0].translation,translations,detectedLanguages,engine:'ai',provider:config.provider,model:config.model};
}
async function requestTranslation(fetch,config,key,input,{signal,timeout=30000}={}){
 const started=Date.now(),request=buildRequest(config,key,input),controller=new AbortController();
 const cancel=()=>controller.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,timeout);
 try{
  const response=await fetch(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(request.body),redirect:'error',signal:controller.signal});
  if(!response.ok){await response.body?.cancel();const message={400:'请求不被模型支持，请检查模型名称和服务地址',401:'API Key 无效或已过期',402:'API 余额不足，请在服务商平台充值',403:'API 没有访问权限，或当前地区不可用',404:'未找到模型或接口，请检查服务地址和模型名称',429:'API 调用过于频繁或额度不足，请稍后重试'}[response.status]||(response.status>=500?'AI 服务暂时不可用，请稍后重试':'API 请求失败');throw new Error(`${message}（${response.status}）`);}
  const reader=response.body.getReader();let size=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new Error('AI 响应过大，请缩短原文');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('API 返回了无效数据，请检查服务地址');}
  return {...parseResponse(data,config,input),ms:Date.now()-started};
 }catch(error){if(controller.signal.aborted)throw new Error(signal?.aborted?'翻译已取消':'AI 连接超时，请检查网络或换用较快的模型');if(error instanceof TypeError||/net::|fetch failed|redirect/i.test(error.message))throw new Error('无法连接 AI 服务，请检查网络、系统代理和 API 服务地址');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function createAI({directory,safeStorage,fetch}){
 const file=path.join(directory,'ai-connection.json');let stored={provider:'deepseek',baseUrl:providers[0].baseUrl,model:providers[0].model,enabled:false,context:true};
 try{const raw=JSON.parse(fs.readFileSync(file,'utf8'));stored={...normalize(raw),encryptedKey:raw.encryptedKey};}catch{}
 const active=new Map(),contexts=new Map();let generation=0;
 const status=()=>({...normalize(stored),hasKey:!!stored.encryptedKey,secureStorage:safeStorage.isEncryptionAvailable(),providers});
 function cancel(channel){if(channel){active.get(channel)?.abort();contexts.delete(channel);}else{generation++;for(const c of active.values())c.abort();contexts.clear();}}
 function keyFor(config,key){if(typeof key==='string'&&key.trim()){if(key.length>4096||/[\r\n]/.test(key))throw new Error('API Key 格式不正确');return key.trim();}if(config.provider!==stored.provider||config.baseUrl!==stored.baseUrl||!stored.encryptedKey)throw new Error('请输入此服务地址对应的 API Key');try{return safeStorage.decryptString(Buffer.from(stored.encryptedKey,'base64'));}catch{throw new Error('无法解密 API Key，请重新输入并保存');}}
 function write(next){fs.mkdirSync(directory,{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2));fs.renameSync(temp,file);stored=next;cancel();return status();}
 function save(args){const config=normalize(args),key=keyFor(config,args.apiKey);if(!safeStorage.isEncryptionAvailable())throw new Error('Windows 密钥加密暂不可用，未保存 API Key');return write({...config,encryptedKey:safeStorage.encryptString(key).toString('base64')});}
 function enable(enabled){if(enabled)keyFor(stored);return write({...stored,enabled:enabled===true});}
 async function translate(input,channel='text',testing){
  const config=testing?normalize(testing):normalize(stored),key=keyFor(config,testing?.apiKey);
  const destinations=[...new Set(input.targets||[input.target||'zh'])];
  if(destinations.length<1||destinations.length>3||destinations.some(t=>!languages[t]))throw new Error('请选择 1 至 3 种目标语言');
  if(typeof input.text!=='string'||input.text.length>5000)throw new Error('每次最多翻译 5000 字符');
  if(!input.text.trim())return {text:input.text,translation:'',translations:destinations.map(target=>({target,translation:'',alignment:[]})),source:input.source,target:destinations[0],engine:'ai',ms:0};
  active.get(channel)?.abort();if(active.size>=5&&!active.has(channel))throw new Error('AI 正在处理其他任务，请稍后重试');
  const controller=new AbortController(),epoch=generation;active.set(channel,controller);
  const previous=contexts.get(channel),recent=previous&&Date.now()-previous.time<120000?previous.items:[];
  const context=!testing&&config.context&&['screen','audio','file'].includes(channel)?recent:[];
  try{const start=Date.now(),request={...input,targets:destinations,context};let result=await requestTranslation(fetch,config,key,request,{signal:controller.signal});if(config.quality==='precise'){result=await requestTranslation(fetch,config,key,{...request,draftTranslations:result.translations.map(({target,translation})=>({target,translation}))},{signal:controller.signal});}result.ms=Date.now()-start;result.quality=config.quality;result.reviewed=config.quality==='precise';if(epoch!==generation||controller.signal.aborted)throw new Error('翻译已取消');if(!testing&&['screen','audio','file'].includes(channel))contexts.set(channel,{time:Date.now(),items:[...recent,{text:input.text.slice(-600),translations:result.translations.map(t=>({target:t.target,translation:t.translation.slice(-600)}))}].slice(-3)});return result;}finally{if(active.get(channel)===controller)active.delete(channel);}
 }
 return {status,save,enable,cancel,enabled:()=>stored.enabled===true,forget:()=>write({...normalize(stored),enabled:false}),translate,test:args=>translate({text:'Please bear in mind: 会议改到明天。Merci pour votre patience.',source:'auto',targets:['zh']},'test',args)};
}
module.exports={createAI,normalize,buildRequest,parseResponse,requestTranslation,agent,providers};
