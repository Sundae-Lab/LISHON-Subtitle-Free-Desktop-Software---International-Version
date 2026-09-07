const test=require('node:test');const assert=require('node:assert/strict');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('latest draft wins, clearing cannot be undone by an old translation',async()=>{
 const {DraftController}=await import('../src/draft-controller.mjs');const requests=[],results=[],errors=[];
 const controller=new DraftController({translate:text=>{const d=deferred();requests.push({text,...d});return d.promise;},onDraft:()=>{},onResult:r=>results.push(r),onBusy:()=>{},onError:e=>errors.push(e)});
 controller.edit('first',{immediate:true});controller.edit('second',{immediate:true});controller.edit('latest',{immediate:true});
 assert.equal(requests.length,1);requests[0].resolve({translation:'OLD'});await new Promise(setImmediate);
 assert.deepEqual(requests.map(r=>r.text),['first','latest']);assert.ok(!results.some(r=>r?.translation==='OLD'));
 controller.edit('');requests[1].resolve({translation:'MUST NOT RETURN'});await new Promise(setImmediate);
 assert.equal(results.at(-1),null);assert.equal(controller.value,'');assert.equal(errors.length,0);controller.dispose();
});
test('manual edits translate after debounce and stale errors are suppressed',async()=>{
 const {DraftController}=await import('../src/draft-controller.mjs');const requests=[],results=[],errors=[];
 const controller=new DraftController({delay:15,translate:text=>{const d=deferred();requests.push({text,...d});return d.promise;},onDraft:()=>{},onResult:r=>results.push(r),onBusy:()=>{},onError:e=>errors.push(e)});
 controller.edit('draft');controller.edit('updated');await new Promise(r=>setTimeout(r,25));assert.equal(requests[0].text,'updated');
 controller.edit('newest',{immediate:true});requests[0].reject(new Error('old'));await new Promise(setImmediate);assert.equal(errors.length,0);
 requests[1].resolve({translation:'NEW'});await new Promise(setImmediate);assert.equal(results.at(-1).translation,'NEW');controller.dispose();
});
