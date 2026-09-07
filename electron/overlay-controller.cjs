const {safeWrite}=require('./pipe-safety.cjs');
const {levelForWidth}=require('./subtitle-width.cjs');
const {screen}=require('electron');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const {moveBounds}=require('./geometry.cjs');
const {capturePolicy}=require('./capture-policy.cjs');
function createOverlayController({getWindow,getSettings,change,native,onError}) {
 let material=null,materialWindow=null,lastMaterial='',gesture=null,lastFit='',pendingFit=null;
 function style(){
  const win=getWindow();if(!win||win.isDestroyed()||gesture?.kind==='move')return;
  if(materialWindow!==win){material?.kill();materialWindow=win;material=spawn(native,['material',win.getNativeWindowHandle().readBigUInt64LE().toString()],{windowsHide:true});const activeMaterial=material;const failed=()=>{if(material===activeMaterial){lastMaterial='';onError(new Error('字幕磨砂组件连接中断，请关闭字幕后重新打开'));}};material.stdin.on('error',failed);material.on('error',failed);readline.createInterface({input:material.stdout}).on('line',line=>{try{const r=JSON.parse(line);if(process.env.LISHON_MATERIAL_DEBUG)require('fs').appendFileSync(process.env.LISHON_MATERIAL_DEBUG,line+'\n');if(r.warning)onError(new Error(r.warning));if(r.error||r.ok===false)onError(new Error(r.error||'Windows 磨砂效果不可用'));}catch{}});material.stderr.resume();lastMaterial='';}
  const s=getSettings(),d=screen.getDisplayMatching(win.getBounds());
  // Windows 11 DWM uses an 8 DIP corner; the renderer and legacy HRGN match it.
  const value={radius:Math.round(16*d.scaleFactor),bounds:win.getSize(),blur:capturePolicy(s).nativeBlur};
  const json=JSON.stringify(value);if(lastMaterial===json)return;lastMaterial=json;safeWrite(material?.stdin,json+'\n',()=>{lastMaterial='';});
 }
 function fit(height,width){
  const w=getWindow();if(!w||w.isDestroyed()||!Number.isFinite(height)||!Number.isFinite(width))return;
  if(gesture?.kind==='move'){pendingFit={height,width};return;}
  const old=w.getContentBounds();if(Math.abs(width-old.width)>2)return;
  const area=screen.getDisplayMatching(old).workArea,h=Math.min(area.height,Math.max(50,Math.round(height)));
  const key=`${Math.round(width)}:${h}`;if(key===lastFit)return;lastFit=key;
  if(Math.abs(old.height-h)>1)w.setContentBounds({...old,height:h},false);style();
 }
 function start(kind,point){const w=getWindow();if(!w||!['move','width','lines'].includes(kind))return;gesture={kind,point,bounds:w.getContentBounds(),settings:{...getSettings()}};pendingFit=null;}
 function move(point){if(!gesture)return;const w=getWindow();if(!w||w.isDestroyed())return;const {kind,point:p,bounds:b,settings:s}=gesture;const dx=point.x-p.x,dy=point.y-p.y;
  if(kind==='move'){const area=screen.getDisplayNearestPoint(point).workArea;const next=moveBounds(b,dx,dy,area),old=w.getContentBounds();if(old.x!==next.x||old.y!==next.y||old.width!==next.width||old.height!==next.height)w.setContentBounds(next,false);}
  if(kind==='width'){const level=levelForWidth(b.width+dx);if(level!==getSettings().widthLevel)change({widthLevel:level});}
  if(kind==='lines'){const fonts=s.multiTarget?s.subtitleTargets.map(t=>t.fontSize):[s.fontSize];const step=fonts.reduce((a,f)=>a+f*1.5+5,0)+(s.bilingual?s.fontSize*.64*1.5:0)+10;const lines=Math.max(1,Math.min(3,s.lines+Math.round(dy/step)));if(lines!==getSettings().lines)change({lines});}
 }
 function end(){const moving=gesture?.kind==='move';gesture=null;const pending=pendingFit;pendingFit=null;if(pending&&!moving)fit(pending.height,pending.width);style();getWindow()?.webContents.send('overlay-moved');}
 return {style,fit,start,move,end,stop(){gesture=null;material?.kill();material=null;materialWindow=null;lastMaterial='';lastFit='';pendingFit=null;}};
}
module.exports={createOverlayController};
