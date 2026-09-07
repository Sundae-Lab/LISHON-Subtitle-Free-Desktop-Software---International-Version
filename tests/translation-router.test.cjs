const test=require('node:test'),assert=require('node:assert/strict');
const {createTranslationRouter}=require('../electron/translation-router.cjs');
test('a superseded language route cannot stop live audio with an old recognition error',async()=>{
 const router=createTranslationRouter({ai:{enabled:()=>false},rpc:async()=>{throw Error('old language failure');}});
 assert.deepEqual((await router.transcribe({},{current:()=>false})).segments,[]);
 await assert.rejects(router.transcribe({},{current:()=>true}),/old language failure/);
});
test('AI text/screen/selection bypass local translation, including mixed source matching target',async()=>{
 const calls=[];const ai={enabled:()=>true,translate:async(a,c)=>(calls.push(c),{...a,translation:'译文'})};
 const router=createTranslationRouter({ai,rpc:()=>{throw Error('must not invoke local translation');}});
 for(const channel of ['text','screen','selection'])assert.equal((await router.translate({text:'中文 and English',source:'zh',target:'zh'},channel)).translation,'译文');
 assert.deepEqual(calls,['text','screen','selection']);
});
test('AI audio and imported files use recognition only, preserve timestamps and emit translated segments',async()=>{
 for(const channel of ['audio','file']){
  const outputs=[];const ai={enabled:()=>true,translate:async args=>({text:args.text,translation:'译文',translations:[{target:'zh',translation:'译文'}]})};
  const router=createTranslationRouter({ai,rpc:async(c,args)=>{assert.equal(c,'transcribe');assert.equal(args.recognizeOnly,true);assert.equal(args.source,'auto');return {source:'en',segments:[{text:'Take it easy. 放轻松。',start:1.2,end:3.4}]};}});
  const result=await router.transcribe({source:'en',target:'zh'},{channel,onSegment:s=>outputs.push(s)});assert.equal(result.segments[0].end,3.4);assert.equal(outputs[0].translation,'译文');
 }
});
test('stopped audio produces no cloud requests and disabled AI preserves the local path',async()=>{
 const ai={enabled:()=>true,translate:()=>{throw Error('stopped');}};
 const router=createTranslationRouter({ai,rpc:async()=>({segments:[{text:'stale'}]})});assert.deepEqual((await router.transcribe({},{current:()=>false})).segments,[]);
 const calls=[];const local=createTranslationRouter({ai:{enabled:()=>false},rpc:async(c,a)=>(calls.push({c,a}),{segments:[]})});await local.translate({text:'local'});await local.transcribe({source:'en'});assert.equal(calls[0].c,'translate');assert.equal(calls[1].a.recognizeOnly,undefined);
});
