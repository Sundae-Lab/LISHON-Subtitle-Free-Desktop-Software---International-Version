const test=require('node:test'),assert=require('node:assert/strict');
test('automatic mode does not report installed translation routes as missing',async()=>{
 const {missingTranslationTargets:missing}=await import('../src/model-readiness.mjs');
 const models={pairs:[['en','zh'],['zh','en'],['en','ja'],['ja','en']]};
 assert.deepEqual(missing({source:'auto',target:'zh'},models),[]);
 assert.deepEqual(missing({source:'auto',target:'zh'},models,'en'),[]);
 assert.deepEqual(missing({source:'auto',target:'zh'},models,'ja'),['zh']);
 assert.deepEqual(missing({source:'ja',target:'zh',aiEnabled:true},models),[]);
});
test('live language swap uses the first multilingual target and actual recognition language',async()=>{
 const {swappedLanguageSettings:swap}=await import('../src/language-swap.mjs');
 const s={source:'auto',target:'zh',multiTarget:true,subtitleTargets:[{code:'zh',fontSize:30},{code:'en',fontSize:26}]};
 assert.equal(swap(s,null),null);
 assert.deepEqual(swap(s,'en'),{source:'zh',target:'en',subtitleTargets:[{code:'en',fontSize:26}]});
 assert.deepEqual(swap({source:'zh',target:'en'}),{source:'en',target:'zh'});
});
