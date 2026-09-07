const test=require('node:test'),assert=require('node:assert/strict'),{Writable}=require('node:stream');
const {protectConsole,safeWrite}=require('../electron/pipe-safety.cjs');const {reply}=require('../electron/ipc-result.cjs');
test('closing launcher stderr cannot turn a console error into an uncaught EPIPE',async()=>{
 const stream=new Writable({write(chunk,encoding,callback){callback(Object.assign(new Error('broken pipe'),{code:'EPIPE'}));}});
 protectConsole(stream);const {Console}=require('node:console');const logger=new Console({stdout:stream,stderr:stream});logger.error('ordinary request failure');await new Promise(r=>setImmediate(r));assert.doesNotThrow(()=>logger.error('later failure'));assert.equal(stream.listenerCount('error')>0,true);
});
test('a failed worker pipe settles the request without attempting a destroyed stream',()=>{
 const errors=[];assert.equal(safeWrite({destroyed:true},'request',e=>errors.push(e.code)),false);assert.deepEqual(errors,['EPIPE']);
 assert.equal(safeWrite({writable:true,write(){throw Object.assign(new Error('closed'),{code:'EPIPE'});}},'request',e=>errors.push(e.code)),false);assert.equal(errors.length,2);
});
test('IPC failures are fulfilled envelopes, preserving useful errors without Electron console.error',async()=>{
 assert.deepEqual(await reply(()=>{throw new Error('API Key 无效（401）');}),{lishonReply:1,ok:false,error:'API Key 无效（401）'});
 assert.deepEqual(await reply(async()=>({translation:'译文'})),{lishonReply:1,ok:true,value:{translation:'译文'}});
});
