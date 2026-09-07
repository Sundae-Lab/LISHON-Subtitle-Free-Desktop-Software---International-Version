const test=require('node:test'),assert=require('node:assert/strict');
const {capturePolicy}=require('../electron/capture-policy.cjs');
const {cleanSettings}=require('../electron/core.cjs');
test('old settings upgrade to screenshot-visible subtitles',()=>{
 const settings=cleanSettings({backgroundBlur:true,backgroundOpacity:44});
 assert.equal(settings.allowSubtitleCapture,true);
 assert.deepEqual(capturePolicy(settings),{protected:false,nativeBlur:true,desktopBlur:false});
});
test('desktop self-capture is never enabled while subtitles are capture-visible',()=>{
 for(const allowed of [true,false])for(const backgroundEnabled of [true,false])for(const backgroundBlur of [true,false])for(const backgroundOpacity of [0,44,100]){
  const p=capturePolicy({allowSubtitleCapture:allowed,backgroundEnabled,backgroundBlur,backgroundOpacity});
  assert.ok(!p.desktopBlur||p.protected);
  assert.ok(!(p.desktopBlur&&p.nativeBlur));
  if(!backgroundEnabled||!backgroundBlur||backgroundOpacity===100)assert.equal(p.desktopBlur||p.nativeBlur,false);
 }
});
test('opt-in protected mode and chosen blur level persist',()=>{
 const settings=cleanSettings({allowSubtitleCapture:false,backgroundBlur:true,blurLevel:7,opacityLevel:5});
 assert.equal(settings.allowSubtitleCapture,false);assert.equal(settings.blurLevel,7);
 assert.deepEqual(capturePolicy(settings),{protected:true,nativeBlur:false,desktopBlur:true});
});
