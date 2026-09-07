const test=require('node:test');const assert=require('node:assert/strict');const {cleanSettings,regionBounds,srt}=require('../electron/core.cjs');
test('settings reject unsupported languages, colors and out-of-range subtitle values',()=>{const s=cleanSettings({fontSize:999,lines:-2,backgroundOpacity:NaN,fontFamily:'bad font',source:'xx',textColor:'url(https://x)'});assert.equal(s.fontSize,64);assert.equal(s.lines,1);assert.equal(s.backgroundOpacity,78);assert.equal(s.source,'en');assert.equal(s.textColor,'#ffffff');});
test('reverse region drag maps correctly on negative-coordinate secondary monitor',()=>{assert.deepEqual(regionBounds({x:900,y:600},{x:100,y:400},{x:-1920,y:-40,width:1920,height:1080}),{x:-1820,y:360,width:800,height:200});});
test('SRT supports millisecond timestamps and bilingual text',()=>{assert.equal(srt([{start:1.25,end:62.005,text:'Hello',translation:'你好'}]),'1\n00:00:01,250 --> 00:01:02,005\nHello\n你好\n');});
test('multi-language settings preserve unique order and cap language/font/blur limits',()=>{
 const s=cleanSettings({multiTarget:true,backgroundBlur:true,blurAmount:100,subtitleTargets:[{code:'ja',fontSize:12},{code:'zh',fontSize:100},{code:'ja',fontSize:28},{code:'xx',fontSize:28},{code:'en',fontSize:32},{code:'fr',fontSize:20}]});
 assert.deepEqual(s.subtitleTargets,[{code:'ja',fontSize:16,textColor:'#ffffff'},{code:'zh',fontSize:64,textColor:'#ffffff'},{code:'en',fontSize:32,textColor:'#ffffff'}]);assert.equal(s.blurAmount,40);assert.equal(s.backgroundBlur,true);
 assert.equal(cleanSettings({subtitleTargets:[]}).subtitleTargets.length,1);
});
test('multilingual SRT preserves target display order',()=>{const text=srt([{start:0,end:1,text:'hello',translations:[{target:'zh',translation:'你好'},{target:'ja',translation:'こんにちは'}]}]);assert.ok(text.endsWith('hello\n你好\nこんにちは\n'));});

test('per-language colors migrate from global and reject invalid overrides; reading controls persist',()=>{
 const s=cleanSettings({textColor:'#305bab',textShadow:false,editorSourceSize:'large',editorTargetSize:'small',subtitleTargets:[{code:'zh',fontSize:28,textColor:'#fe9f4d'},{code:'ja',fontSize:30,textColor:'red'},{code:'fr',fontSize:24}]});
 assert.deepEqual(s.subtitleTargets.map(t=>t.textColor),['#fe9f4d','#305bab','#305bab']);assert.equal(s.textShadow,false);assert.equal(s.editorSourceSize,'large');assert.equal(s.editorTargetSize,'small');assert.equal(cleanSettings({editorSourceSize:'huge'}).editorSourceSize,'medium');
});
