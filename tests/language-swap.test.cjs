const test=require('node:test'),assert=require('node:assert/strict');
test('swap exchanges source and target and uses only the matching current translation',async()=>{
 const {swappedLanguageDraft:swap}=await import('../src/language-swap.mjs');
 const s={source:'en',target:'zh',multiTarget:false};
 assert.deepEqual(swap(s,'Hello',{text:'Hello',source:'en',target:'zh',translation:'你好'}),{settings:{source:'zh',target:'en'},text:'你好'});
 assert.equal(swap(s,'New draft',{text:'Old draft',target:'zh',translation:'过时结果'}).text,'New draft');
 assert.deepEqual(swap(s,'',null),{settings:{source:'zh',target:'en'},text:''});
});
test('automatic source uses the detected language and never guesses English before detection',async()=>{
 const {swappedLanguageDraft:swap}=await import('../src/language-swap.mjs');
 assert.equal(swap({source:'auto',target:'zh'},'Bonjour',null),null);
 assert.deepEqual(swap({source:'auto',target:'zh'},'Bonjour',{text:'Bonjour',source:'fr',target:'zh',translation:'你好'}),{settings:{source:'zh',target:'fr'},text:'你好'});
});
test('multilingual swap uses the first target, preserves styles and avoids duplicate targets',async()=>{
 const {swappedLanguageDraft:swap}=await import('../src/language-swap.mjs');
 const s={source:'en',target:'ko',multiTarget:true,subtitleTargets:[{code:'zh',fontSize:30},{code:'ja',fontSize:26},{code:'en',fontSize:32}]};
 const result=swap(s,'Hello',{text:'Hello',translations:[{target:'ja',translation:'こんにちは'},{target:'zh',translation:'你好'}]});
 assert.equal(result.text,'你好');assert.equal(result.settings.source,'zh');assert.equal(result.settings.target,'en');
 assert.deepEqual(result.settings.subtitleTargets,[{code:'en',fontSize:32},{code:'ja',fontSize:26}]);
});
