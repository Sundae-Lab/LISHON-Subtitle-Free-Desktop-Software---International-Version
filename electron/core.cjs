const {widthLevel,widthForLevel,levelForWidth}=require('./subtitle-width.cjs');
const defaults = {uiLanguage:'zh',theme:'light',closeAction:'ask',source:'en',target:'zh',fontSize:28,fontFamily:'Microsoft YaHei UI',textColor:'#ffffff',textShadow:true,editorSourceSize:'medium',editorTargetSize:'medium',backgroundColor:'#16171d',backgroundOpacity:78,opacityLevel:8,favoriteBackground:'#2457c5',favoriteColor:'#ffffff',libraryDates:false,allowSubtitleCapture:true,backgroundBlur:false,backgroundEnabled:true,blurTone:'dark',blurLevel:4,blurAmount:16,widthLevel:4,lines:2,bilingual:true,overlayWidth:760,chunkSeconds:3,history:false,multiTarget:false,subtitleTargets:[{code:'zh',fontSize:28,textColor:'#ffffff'}]};
function cleanSettings(value={}) {
 const out={...defaults};
 if(['zh','en','ja','ko','fr','ru'].includes(value.uiLanguage))out.uiLanguage=value.uiLanguage;
 const allowed=['en','zh','ja','ko','fr','de','es','ru'];
 for(const key of ['fontSize','backgroundOpacity','blurAmount','lines','overlayWidth','chunkSeconds']) {
  const range={fontSize:[16,64],backgroundOpacity:[0,100],blurAmount:[1,40],lines:[1,3],overlayWidth:[400,3840],chunkSeconds:[2,8]}[key];
  if(Number.isFinite(value[key])) out[key]=Math.max(range[0],Math.min(range[1],value[key]));
 }
 for(const key of ['textColor','backgroundColor','favoriteBackground','favoriteColor']) if(/^#[a-f\d]{6}$/i.test(value[key])) out[key]=value[key];
 if(['ask','minimize','quit'].includes(value.closeAction))out.closeAction=value.closeAction;
 if(['light','dark'].includes(value.theme)) out.theme=value.theme;
 if(['Segoe UI','Microsoft YaHei UI','SimHei','SimSun'].includes(value.fontFamily)) out.fontFamily=value.fontFamily;
 if([...allowed,'auto'].includes(value.source)) out.source=value.source;
 if(allowed.includes(value.target)) out.target=value.target;
 for(const key of ['allowSubtitleCapture','bilingual','history','backgroundBlur','backgroundEnabled','multiTarget','libraryDates','textShadow']) if(typeof value[key]==='boolean') out[key]=value[key];
 for(const key of ['editorSourceSize','editorTargetSize'])if(['small','medium','large'].includes(value[key]))out[key]=value[key];
 out.lines=Math.round(out.lines);
 out.opacityLevel=Number.isFinite(value.opacityLevel)?Math.max(1,Math.min(10,Math.round(value.opacityLevel))):Math.round(out.backgroundOpacity/100*9)+1;
 out.backgroundOpacity=Math.round((out.opacityLevel-1)*100/9);
 out.widthLevel=Number.isFinite(value.widthLevel)?widthLevel(value.widthLevel):levelForWidth(out.overlayWidth);
 out.overlayWidth=widthForLevel(out.widthLevel);
 out.blurLevel=Number.isFinite(value.blurLevel)?Math.max(1,Math.min(10,Math.round(value.blurLevel))):Math.max(1,Math.min(10,Math.round(out.blurAmount/4)));
 out.blurAmount=out.blurLevel*4;
 if(['dark','light'].includes(value.blurTone))out.blurTone=value.blurTone;
 if(Array.isArray(value.subtitleTargets)) {
  const seen=new Set();out.subtitleTargets=value.subtitleTargets.filter(x=>x&&allowed.includes(x.code)&&!seen.has(x.code)&&seen.add(x.code)).slice(0,3).map(x=>({code:x.code,textColor:/^#[a-f\d]{6}$/i.test(x.textColor)?x.textColor:out.textColor,fontSize:Number.isFinite(x.fontSize)?Math.max(16,Math.min(64,x.fontSize)):out.fontSize}));
 }
 if(!out.subtitleTargets.length)out.subtitleTargets=[{code:out.target,fontSize:out.fontSize,textColor:out.textColor}];
 return out;
}
function targets(settings){return settings.multiTarget?settings.subtitleTargets.map(x=>x.code):[settings.target];}
function regionBounds(start,end,display) {
 const x=Math.max(0,Math.min(start.x,end.x)),y=Math.max(0,Math.min(start.y,end.y));
 const width=Math.min(display.width-x,Math.abs(end.x-start.x)),height=Math.min(display.height-y,Math.abs(end.y-start.y));
 return {x:Math.round(display.x+x),y:Math.round(display.y+y),width:Math.round(width),height:Math.round(height)};
}
function timestamp(seconds) {const ms=Math.round(Math.max(0,seconds)*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
function srt(segments) {return segments.map((s,i)=>`${i+1}\n${timestamp(s.start)} --> ${timestamp(s.end)}\n${s.text}\n${s.translations?.length?s.translations.map(t=>t.translation).join('\n'):s.translation}\n`).join('\n');}
module.exports={defaults,cleanSettings,regionBounds,srt,targets};
