const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {normalize,buildRequest,parseResponse,requestTranslation,createAI,providers,agent}=require('../electron/ai-translation.cjs');
const base={provider:'deepseek',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-chat',enabled:true,context:true};
const input={text:'Keep an eye on the deadline，别忘了。Merci !',source:'en',targets:['zh','ja']};
const content=JSON.stringify({detectedLanguages:['en','zh','fr'],translations:[{target:'zh',translation:'留意截止日期，别忘了。谢谢！'},{target:'ja',translation:'締め切りに気を配って、忘れないで。ありがとう！'}]});
const response=()=>new Response(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}]}));
test('all provider presets have request adapters and source language is only a hint',()=>{
 for(const p of providers.filter(x=>x.id!=='custom')){
  const req=buildRequest(normalize({...p,provider:p.id}), 'test-only',input);
  assert.ok(req.url.startsWith('https://'));assert.equal(req.headers['Content-Type'],'application/json');
  const user=JSON.parse(req.body.messages.at(-1).content);assert.equal(user.currentText,input.text);assert.deepEqual(user.targets.map(t=>t.code),['zh','ja']);
  assert.equal(p.id==='claude'?req.headers['x-api-key']:req.headers.Authorization,p.id==='claude'?'test-only':'Bearer test-only');
 }
 assert.match(agent,/mixed|mix/i);assert.match(agent,/not instructions/);assert.match(agent,/fixed expressions/);
});
test('endpoints reject credential URLs, remote cleartext and secret query strings',()=>{
 for(const url of ['http://example.com/v1','https://user:pass@example.com/v1','https://example.com/v1?key=secret','file:///tmp/api'])assert.throws(()=>normalize({...base,baseUrl:url}));
 assert.equal(normalize({...base,baseUrl:base.baseUrl+'/chat/completions/'}).baseUrl,base.baseUrl);
 assert.equal(normalize({...base,baseUrl:'http://127.0.0.1:8765/v1'}).baseUrl,'http://127.0.0.1:8765/v1');
});
test('mixed languages and every ordered target survive without same-source short circuit',()=>{
 const result=parseResponse({choices:[{message:{content}}]},base,input);assert.equal(result.engine,'ai');assert.deepEqual(result.detectedLanguages,['en','zh','fr']);assert.equal(result.translations.length,2);
 const claude=parseResponse({content:[{type:'text',text:content}]},{...base,provider:'claude'},input);assert.deepEqual(claude.translations,result.translations);
 assert.throws(()=>parseResponse({choices:[{message:{content:'{"translations":[]}'}}]},base,input),/所有目标/);
 assert.throws(()=>parseResponse({choices:[{message:{content},finish_reason:'length'}]},base,input),/截断/);
});
test('actual HTTP body is bounded, redirects disallowed and provider errors do not echo keys',async()=>{
 let options;const result=await requestTranslation(async(url,opts)=>{options=opts;return response();},base,'test-only',input);
 assert.equal(options.redirect,'error');assert.equal(result.translation,'留意截止日期，别忘了。谢谢！');
 await assert.rejects(()=>requestTranslation(async()=>new Response('secret in upstream error',{status:401}),base,'secret',input),/API Key 无效.*401/);
 await assert.rejects(()=>requestTranslation(async()=>new Response('x'.repeat(1024*1024+1)),base,'secret',input),/响应过大/);
 await assert.rejects(()=>requestTranslation(async(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted')))),base,'secret',input,{timeout:10}),/超时/);
});
function fixture(fetch){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lishon-ai-unit-'));const safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from([...s].reverse().join('')),decryptString:b=>[...b.toString()].reverse().join('')};return {directory,ai:createAI({directory,safeStorage,fetch}),safeStorage};}
test('keys stay out of status, stay bound to endpoint, and context is channel bounded and erasable',async()=>{
 const calls=[];const t=fixture(async(url,opts)=>{calls.push(JSON.parse(opts.body));return response();});
 try{t.ai.save({...base,apiKey:'unit-secret-key'});assert.equal(JSON.stringify(t.ai.status()).includes('unit-secret-key'),false);assert.equal(fs.readFileSync(path.join(t.directory,'ai-connection.json'),'utf8').includes('unit-secret-key'),false);
  assert.throws(()=>t.ai.save({...base,baseUrl:'https://example.com/v1'}),/API Key/);
  for(let i=0;i<5;i++)await t.ai.translate({...input,text:input.text+i},'audio');
  const last=JSON.parse(calls.at(-1).messages[1].content);assert.equal(last.previousContext.length,3);
  await t.ai.translate(input,'text');assert.equal(JSON.parse(calls.at(-1).messages[1].content).previousContext.length,0);
  t.ai.cancel('audio');await t.ai.translate(input,'audio');assert.equal(JSON.parse(calls.at(-1).messages[1].content).previousContext.length,0);
  const restored=createAI({directory:t.directory,safeStorage:t.safeStorage,fetch:async()=>response()});assert.equal(restored.enabled(),true);await restored.translate(input);
  restored.forget();assert.equal(restored.status().hasKey,false);assert.equal(restored.enabled(),false);
 }finally{fs.rmSync(t.directory,{recursive:true,force:true});}
});
test('disabling AI aborts an in-flight request and cannot publish it',async()=>{
 const t=fixture(async(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted')))));
 try{t.ai.save({...base,apiKey:'test-key'});const task=t.ai.translate(input,'screen');t.ai.enable(false);await assert.rejects(task,/已取消/);}finally{fs.rmSync(t.directory,{recursive:true,force:true});}
});

test('precise mode reviews against the unchanged original and keeps only the reviewed result',async()=>{
 const calls=[];const t=fixture(async(url,opts)=>{calls.push(JSON.parse(opts.body));return response();});
 try{t.ai.save({...base,quality:'precise',apiKey:'test-key'});const result=await t.ai.translate(input,'audio');assert.equal(calls.length,2);const review=JSON.parse(calls[1].messages[1].content);assert.equal(review.currentText,input.text);assert.equal(review.task,'review-against-original');assert.equal(review.draftTranslations.length,2);assert.equal(result.reviewed,true);}finally{fs.rmSync(t.directory,{recursive:true,force:true});}
});
test('null JSON and incomplete language results report format failures',()=>{assert.throws(()=>parseResponse({choices:[{message:{content:'null'}}]},base,input),/未完整/);});
