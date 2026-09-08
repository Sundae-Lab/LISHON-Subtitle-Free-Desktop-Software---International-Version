const {protectConsole,safeWrite}=require('./pipe-safety.cjs');
protectConsole(process.stdout);protectConsole(process.stderr);
const {reply}=require('./ipc-result.cjs');
const {translate}=require('../shared/i18n.mjs');
const t=message=>translate(message,settings?.uiLanguage||'zh');
const {app,BrowserWindow,ipcMain,screen,dialog,shell,clipboard,globalShortcut,session,desktopCapturer,nativeTheme,safeStorage,net}=require('electron');
const {spawn,execFile}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const mainGlass=process.platform==='win32'&&Number(require('node:os').release().split('.')[2])>=22621;
const readline=require('node:readline');
const {cleanSettings,srt,targets}=require('./core.cjs');
const {createOverlayController}=require('./overlay-controller.cjs');
const {resizeRegion}=require('./geometry.cjs');
const {capturePolicy}=require('./capture-policy.cjs');
const {createAI}=require('./ai-translation.cjs');
const {createTranslationRouter}=require('./translation-router.cjs');
let ai,translationRouter,aiRevision=0,activeFileJob=null;
const {createHistoryReader}=require('./history-reader.cjs');
let historyReader;
const {createHistory}=require('./session-history.cjs');
function chineseSequence(n){const digits='零一二三四五六七八九';if(n<10)return digits[n];if(n<100)return (n<20?'':digits[Math.floor(n/10)])+'十'+(n%10?digits[n%10]:'');return String(n);}
const sessionHistory=createHistory({onChange:()=>{send('history-changed',{});historyReader?.changed();},onError:fail,name:n=>translate('历史记录{0}',settings?.uiLanguage||'zh',[settings?.uiLanguage==='zh'?chineseSequence(n):n])});
let historyTimer,audioRecording=false;
const {applyInstallerModelPath}=require('./installer-path.cjs');
app.setPath('userData',process.env.LINGUA_DATA_DIR||path.join(app.getPath('appData'),'lishon-international'));
let quitting=false,closingPrompt=false;
let main,overlay,worker,watcher,settings,preferences={},history=[],region=null,regionPicker=null,screenTimer,screenEpoch=0,selectionEpoch=0,overlayVisible=false,lastOverlay=null,lastSegments=[],audioArmed=0;
let sequence=0,audioEpoch=0,captionSequence=0;const pending=new Map();
const dev=process.env.LINGUA_DEV_URL;
const base=app.isPackaged?process.resourcesPath:path.join(__dirname,'..');
const native=process.env.LISHON_NATIVE_EXE||path.join(base,app.isPackaged?'native':'native/publish','Lingua.Native.exe');
const dataFile=()=>path.join(app.getPath('userData'),'settings.json');
const historyFile=()=>path.join(app.getPath('userData'),'history.json');
const modelPath=()=>preferences.modelPath||path.join(app.getPath('userData'),'models');
function loadJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function save(){fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(dataFile(),JSON.stringify({...settings,modelPath:preferences.modelPath,installerLocationId:preferences.installerLocationId},null,2));}
function rememberDataLocations(){
 const file=path.join(app.getPath('userData'),'data-locations.json'),old=loadJson(file,{version:1,models:[],histories:[]});
 const models=[...new Set([...(old.models||[]),modelPath()])];const histories=[...new Set([...(old.histories||[]),settings.historyDirectory].filter(Boolean))];
 fs.writeFileSync(file,JSON.stringify({version:1,models,histories}));
}
function send(event,value){if(main&&!main.isDestroyed())main.webContents.send(event,value);}
function fail(error){send('error',String(error.message||error));}
let captions=[],regionHandles=[],regionGesture=null,screenActive=false,screenPaused=false,screenPrevious='';
const overlayControl=createOverlayController({getWindow:()=>overlay,getSettings:()=>settings,change:part=>persistSettings({...settings,...part}),native,onError:fail});
function refreshAI(){aiRevision++;activeFileJob=null;settings.aiEnabled=ai.enabled();settings.aiRevision=aiRevision;audioEpoch++;haltScreen();screenPrevious='';if(screenActive&&!screenPaused)scheduleScreen();send('settings',settings);send('ai-state',ai.status());return ai.status();}
function translationArgs(text){return {text,source:settings.source,target:settings.target,targets:targets(settings)};}
function persistSettings(next){sessionHistory.configure(next.historyDirectory,next.historyEnabled);
if(settings&&next.textColor!==settings.textColor)next={...next,subtitleTargets:next.subtitleTargets.map(t=>({...t,textColor:next.textColor}))};settings=cleanSettings(next);settings.aiEnabled=ai?.enabled()||false;settings.aiRevision=aiRevision;if(nativeTheme.themeSource!==settings.theme){nativeTheme.themeSource=settings.theme;if(main&&!mainGlass)main.setBackgroundColor(settings.theme==='dark'?'#000000':'#ffffff');}if(main&&!main.isDestroyed())main.setTitle(t('听现 Lishon'));save();rememberDataLocations();if(settings.historyEnabled){if(screenActive){sessionHistory.begin('screen');sessionHistory.pause('screen',screenPaused);}if(audioRecording)sessionHistory.begin('audio');}overlaySettings();for(const w of regionHandles)if(!w.isDestroyed())w.webContents.send('settings',settings);send('settings',settings);historyReader?.settings(settings);return settings;}
function workerStart(){
 const executable=process.env.LISHON_ENGINE_EXE||(app.isPackaged?path.join(base,'engine','lingua-engine.exe'):path.join(base,'.venv','Scripts','python.exe'));
 const args=app.isPackaged||process.env.LISHON_ENGINE_EXE?[modelPath()]:['-u',path.join(base,'engine','service.py'),modelPath()];
 worker=spawn(executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8',LISHON_LIBRARY_DIR:app.getPath('userData'),LISHON_LEGACY_MODEL_DIR:path.join(app.getPath('userData'),'models')}});
 readline.createInterface({input:worker.stdout}).on('line',line=>{try{const msg=JSON.parse(line);if(msg.id){const request=pending.get(msg.id);if(request){clearTimeout(request.timer);pending.delete(msg.id);msg.error?request.reject(new Error(msg.error)):request.resolve(msg.result);}}else if(msg.event==='ready')send('ready',{});else if(msg.event==='segment'){if(msg.job===activeFileJob)send('segment',{...msg,job:'file'});}else send(msg.event,msg);}catch{}});
 worker.stderr.on('data',data=>{try{const file=path.join(app.getPath('userData'),'engine.log');if(fs.existsSync(file)&&fs.statSync(file).size>262144)fs.writeFileSync(file,'');fs.appendFileSync(file,String(data).slice(0,8000));}catch{}});
 const activeWorker=worker;
 const rejectAll=()=>{if(activeWorker!==worker)return;for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('本地引擎已停止，请重新启动应用。'));}pending.clear();};
 worker.stdin.on('error',rejectAll);
 worker.on('error',e=>{fail(e);rejectAll();});worker.on('exit',rejectAll);
}
function rpc(command,args={},timeout=120000){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('处理超时，请检查模型或缩短输入后重试。'));},timeout);pending.set(id,{resolve,reject,timer});safeWrite(worker?.stdin,JSON.stringify({id,command,args})+'\n',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(error);}});});}
function nativeCall(args){return new Promise((resolve,reject)=>execFile(native,args.map(String),{windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:1024*1024},(error,stdout)=>{try{const value=JSON.parse(stdout.trim());if(value.error)reject(new Error(value.error));else resolve(value);}catch{reject(error||new Error('Windows 识别组件返回异常'));}}));}
function windowOptions(extra={}){return {...extra,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}};}
function loadWindow(win,query={}){if(dev){const url=new URL(dev);for(const [k,v]of Object.entries(query))url.searchParams.set(k,v);return win.loadURL(url.href);}return win.loadFile(path.join(__dirname,'../dist/index.html'),{query});}
async function requestMainClose(){
 if(closingPrompt)return;
 if(settings.closeAction==='ask'){closingPrompt=true;send('close-request');return;}
 if(settings.closeAction==='minimize')main.minimize();else if(settings.closeAction==='quit')app.quit();
}
function resolveMainClose({choice,remember}){
 if(!closingPrompt||!['cancel','minimize','quit'].includes(choice))return false;
 if(choice!=='cancel'&&remember===true)persistSettings({...settings,closeAction:choice});
 closingPrompt=false;
 if(choice==='minimize')main.minimize();else if(choice==='quit')setImmediate(()=>app.quit());
 return true;
}
function createMain(){nativeTheme.themeSource=settings.theme;main=new BrowserWindow(windowOptions({width:1240,height:860,minWidth:820,minHeight:620,frame:false,show:false,backgroundColor:mainGlass?'#00000000':(settings.theme==='dark'?'#000000':'#ffffff'),...(mainGlass?{backgroundMaterial:'acrylic'}:{}),title:t('听现 Lishon'),icon:path.join(__dirname,'../build/icon.ico')}));loadWindow(main);main.once('ready-to-show',()=>main.show());main.webContents.setWindowOpenHandler(()=>({action:'deny'}));main.webContents.on('will-navigate',event=>event.preventDefault());main.on('close',event=>{if(quitting)return;event.preventDefault();requestMainClose().catch(fail);});main.on('closed',()=>app.quit());}
function backdropGeometry(){if(!overlay||overlay.isDestroyed())return null;const b=overlay.getContentBounds(),d=screen.getDisplayMatching(b);return {window:b,display:d.bounds,displayId:d.id};}
function overlayPosition(){const g=backdropGeometry();if(g)overlay.webContents.send('overlay-position',g);}
function overlayHeight(){const fonts=settings.multiTarget?settings.subtitleTargets.map(t=>t.fontSize):[settings.fontSize];return Math.round(54+(settings.bilingual?settings.fontSize*.64*1.5*settings.lines:0)+fonts.reduce((sum,f)=>sum+f*1.5*settings.lines+7,0));}
function overlaySettings(){if(!overlay||overlay.isDestroyed())return;const old=overlay.getContentBounds();const d=screen.getDisplayMatching(old).workArea;const width=Math.min(settings.overlayWidth,d.width);if(Math.abs(old.width-width)>1)overlay.setContentBounds({...old,width},false);if(capturePolicy(settings).protected)overlay.setContentProtection(true);overlay.webContents.send('settings',settings);overlayControl.style();}
function showOverlay(){
 if(!overlay||overlay.isDestroyed()){
  const d=region?screen.getDisplayMatching(region).workArea:screen.getPrimaryDisplay().workArea;
  const width=Math.min(settings.overlayWidth,d.width);const height=overlayHeight();
  let x=d.x+(d.width-width)/2,y=Math.max(d.y,d.y+d.height-Math.max(height,54+(height-54)/settings.lines*3)-50);
  if(region){x=Math.max(d.x,Math.min(region.x,d.x+d.width-width));y=region.y+region.height+8;if(y+height>d.y+d.height)y=Math.max(d.y,region.y-height-8);}
  overlay=new BrowserWindow(windowOptions({x:Math.round(x),y:Math.round(y),width,height,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,resizable:false,hasShadow:false,show:false}));
  overlay.on('resize',()=>{overlayControl.style();overlayPosition();});overlay.on('move',overlayPosition);overlay.on('hide',()=>overlay.webContents.send('overlay-visibility',false));overlay.on('show',()=>overlay.webContents.send('overlay-visibility',true));
  overlay.setAlwaysOnTop(true,'screen-saver');overlay.setContentProtection(capturePolicy(settings).protected);loadWindow(overlay,{view:'overlay'});
  overlay.webContents.once('did-finish-load',()=>{overlaySettings();if(lastOverlay)overlay.webContents.send('result',lastOverlay);overlay.showInactive();if(settings.backgroundBlur)overlayControl.style();});
  overlay.on('closed',()=>{overlayControl.stop();overlay=null;overlayVisible=false;send('overlay-state',false);});
 }else {overlay.showInactive();if(settings.backgroundBlur)overlayControl.style();}
 overlayVisible=true;send('overlay-state',true);
}
function publish(result,origin){try{sessionHistory.add(origin,result);}catch(e){fail(e);}const item={...result,origin,id:Date.now()+'-'+(++captionSequence),time:new Date().toISOString()};send('result',item);if(settings.history){history.unshift(item);history=history.slice(0,30);fs.writeFileSync(historyFile(),JSON.stringify(history));}if(origin!=='selection'&&origin!=='text'){lastOverlay=item;captions=[...captions,item].slice(-3);if(overlay&&!overlay.isDestroyed())overlay.webContents.send('result',item);}return item;}
function selection(enabled){
 selectionEpoch++;if(watcher){watcher.kill();watcher=null;}
 if(enabled){
  const epoch=selectionEpoch;
  watcher=spawn(native,['watch',String(process.pid)],{windowsHide:true});
  readline.createInterface({input:watcher.stdout}).on('line',line=>{if(epoch!==selectionEpoch)return;if(process.env.LINGUA_NATIVE_DEBUG)fs.appendFileSync(path.join(app.getPath('userData'),'native-test.log'),line+'\n');try{const data=JSON.parse(line);if(data.text)send('selection-text',{text:data.text.slice(0,5000),method:data.method});if(data.error)fail(data.error);}catch{}});
  watcher.stderr.on('data',data=>{if(process.env.LINGUA_NATIVE_DEBUG)fs.appendFileSync(path.join(app.getPath('userData'),'native-test.log'),String(data));});
  watcher.on('error',e=>{if(epoch===selectionEpoch){watcher=null;send('selection-state',false);fail(e);}});
  watcher.on('exit',code=>{if(process.env.LINGUA_NATIVE_DEBUG)fs.appendFileSync(path.join(app.getPath('userData'),'native-test.log'),'exit '+code+'\n');if(epoch===selectionEpoch){watcher=null;send('selection-state',false);if(code)fail(new Error('划词组件已停止，请重新开启自动划词。'));}});
 }
 send('selection-state',enabled);return enabled;
}
function screenStatus(){return {active:screenActive,paused:screenPaused,region};}
function emitScreen(){send('screen-state',screenStatus());}
function haltScreen(){screenEpoch++;clearTimeout(screenTimer);screenTimer=null;ai?.cancel('screen');}
function closeMarkers(){for(const w of regionHandles)if(!w.isDestroyed())w.close();regionHandles=[];regionGesture=null;}
function stopScreen(clear=false){sessionHistory.end('screen');haltScreen();screenActive=false;screenPaused=false;screenPrevious='';if(clear){closeMarkers();region=null;overlay?.close();lastOverlay=null;captions=[];}emitScreen();}
function scheduleScreen(){
 const epoch=screenEpoch;
 const tick=async()=>{if(epoch!==screenEpoch||!screenActive||screenPaused||!region)return;
  const area={...region};
  try{
   const d=screen.getDisplayMatching(area),p=screen.dipToScreenPoint({x:area.x,y:area.y});
   const language={en:'en-US',zh:'zh-Hans',ja:'ja-JP',ko:'ko-KR',fr:'fr-FR',de:'de-DE',es:'es-ES',ru:'ru-RU',auto:'auto'}[settings.source];
   const data=['en','zh','auto'].includes(settings.source)?await rpc('ocr',{x:p.x,y:p.y,width:Math.round(area.width*d.scaleFactor),height:Math.round(area.height*d.scaleFactor)}):await nativeCall(['ocr',p.x,p.y,Math.round(area.width*d.scaleFactor),Math.round(area.height*d.scaleFactor),language]);
   if(epoch!==screenEpoch)return;
   const text=data.text;
   if(text.trim()&&text!==screenPrevious){const result=await translationRouter.translate(translationArgs(text.slice(0,5000)),'screen');if(epoch!==screenEpoch)return;publish(result,'screen');screenPrevious=text;}
   if(!text.trim()){screenPrevious='';lastOverlay={id:'blank',text:'',translation:''};overlay?.webContents.send('result',lastOverlay);}
  }catch(e){if(epoch===screenEpoch){haltScreen();screenPaused=true;sessionHistory.pause('screen',true);emitScreen();main.restore();fail(e);}return;}
  if(epoch===screenEpoch)screenTimer=setTimeout(tick,650);
 };
 screenTimer=setTimeout(tick,250);
}
async function startScreen(){if(!region)throw new Error('请先点击开始选框，选择需要识别的文字区域');haltScreen();screenActive=true;screenPaused=false;sessionHistory.begin('screen');screenPrevious='';showOverlay();emitScreen();scheduleScreen();return screenStatus();}
function pauseScreen(){if(!screenActive)return screenStatus();haltScreen();screenPaused=!screenPaused;sessionHistory.pause('screen',screenPaused);emitScreen();if(!screenPaused)scheduleScreen();return screenStatus();}
function chooseRegion(){
 stopScreen();closeMarkers();regionPicker?.kill();overlay?.hide();main.hide();
 const child=spawn(native,['pick-region'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,LISHON_PICKER_HINT:t('拖动选择识别文字区域  ·  Esc 取消')}});regionPicker=child;
 let result=null,stderr='';child.stderr.on('data',d=>{stderr+=String(d).slice(0,2000);if(process.env.LISHON_PICKER_DEBUG)fs.appendFileSync(path.join(app.getPath('userData'),'picker-debug.log'),String(d));});
 readline.createInterface({input:child.stdout}).on('line',line=>{try{result=JSON.parse(line);}catch{}});
 const finish=error=>{if(regionPicker!==child)return;regionPicker=null;
  if(result&&!result.cancelled&&!result.error&&[result.x,result.y,result.width,result.height].every(Number.isFinite)){
   const point=screen.screenToDipPoint({x:result.x,y:result.y}),d=screen.getDisplayNearestPoint(point);
   region={x:Math.round(point.x),y:Math.round(point.y),width:Math.round(result.width/d.scaleFactor),height:Math.round(result.height/d.scaleFactor)};
  }
  showRegionMarker();if(main&&!main.isDestroyed())main.show();emitScreen();
  if(error||result?.error)fail(error||new Error(result.error));
 };
 child.on('error',finish);child.on('exit',code=>finish(code?new Error(stderr||'选区工具已退出，请重新选框'):null));return true;
}
function updateMarkers(){if(!region)return;const b=region;const set=(w,next)=>{if(!w||w.isDestroyed())return;const old=w.getContentBounds();if(Object.keys(next).some(k=>Math.abs(old[k]-next[k])>1))w.setContentBounds(next,false);};for(const w of regionHandles){const c=w._corner;set(w,{x:(c.includes('w')?b.x:b.x+b.width)-20,y:(c.includes('n')?b.y:b.y+b.height)-20,width:40,height:40});}}
function showRegionMarker(){
 closeMarkers();if(!region)return;
 const options={frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,skipTaskbar:true,resizable:false,hasShadow:false,focusable:false,show:false};
 for(const corner of ['nw','ne','sw','se']){const w=new BrowserWindow(windowOptions({...options,width:40,height:40}));w._corner=corner;regionHandles.push(w);w.setAlwaysOnTop(true,'screen-saver');w.setContentProtection(true);loadWindow(w,{view:'handle',corner});w.once('ready-to-show',()=>{if(!w.isDestroyed()){w.webContents.send('settings',settings);updateMarkers();w.showInactive();}});}
}
function regionInteract(sender,args){
 const handle=regionHandles.find(w=>w.webContents.id===sender.id);if(!handle||!region)return;
 if(args.action==='end'){if(!regionGesture)return;regionGesture=null;screenPrevious='';emitScreen();if(screenActive&&!screenPaused)scheduleScreen();return;}
 const point=args.point;if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
 if(args.action==='start'){haltScreen();regionGesture={corner:handle._corner,point,bounds:{...region},area:screen.getDisplayMatching(region).bounds,axis:null};return;}
 if(args.action!=='move'||!regionGesture)return;
 const g=regionGesture,dx=point.x-g.point.x,dy=point.y-g.point.y;
 if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=3)g.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
 if(g.axis){region=resizeRegion(g.bounds,g.corner,g.axis,dx,dy,g.area);updateMarkers();}
}

async function handleCommand(event,command,args={}){
 const fromMain=main&&event.sender.id===main.webContents.id;
 const fromOverlay=overlay&&event.sender.id===overlay.webContents.id;
 const fromReader=historyReader?.owns(event.sender);
 const fromHandle=regionHandles.some(w=>w.webContents.id===event.sender.id);
 if(!fromMain&&!((fromReader&&command==='history-reader')||(fromOverlay&&['bootstrap','overlay','overlay-fit','overlay-interact','overlay-backdrop','overlay-backdrop-error','overlay-backdrop-stopped'].includes(command))||(fromHandle&&command==='region-interact')))throw new Error('无权执行此操作');
 switch(command){
 case 'history-reader':return historyReader.command(args);
 case 'ai-status':return ai.status();
 case 'ai-save':ai.save(args);return refreshAI();
 case 'ai-enable':ai.enable(args.enabled);return refreshAI();
 case 'ai-forget':ai.forget();return refreshAI();
 case 'ai-test':return ai.test(args);
 case 'ai-portal':{const provider=ai.status().providers.find(p=>p.id===args.provider);const url=args.docs?provider?.docs:provider?.portal;if(url)await shell.openExternal(url);return true;}
 case 'translate-cancel':ai.cancel('text');return true;
 case 'bootstrap':{const [models,favoriteTerms,ocr]=await Promise.all([fromOverlay?null:rpc('status'),rpc('library',{action:'terms'}),fromOverlay?[]:nativeCall(['languages']).catch(()=>[])]);return {settings,models,history,captions,favoriteTerms,region,screenState:screenStatus(),overlayVisible,desktop:true,ocr};}
 case 'settings':{const next=cleanSettings({...settings,...args});if(next.source!==settings.source||next.target!==settings.target||JSON.stringify(targets(next))!==JSON.stringify(targets(settings))){audioEpoch++;activeFileJob=null;ai.cancel();haltScreen();screenPrevious='';}persistSettings(next);if(screenActive&&!screenPaused&&!screenTimer)scheduleScreen();return settings;}
 case 'library':{const result=await rpc('library',args);if(args.action&&args.action!=='list'){const terms=await rpc('library',{action:'terms'});send('library-index',terms);overlay?.webContents.send('library-index',terms);}return result;}
 case 'lookup':return rpc('lookup',{term:String(args.term||'').slice(0,100),source:args.source||settings.source,target:args.target||settings.target});
 case 'translate-selection':return translationRouter.translate({text:String(args.text||'').slice(0,5000),source:args.source||settings.source,target:args.target||settings.target,targets:args.targets||targets(settings)},'selection');
 case 'translate':{const result=await translationRouter.translate(translationArgs(String(args.text||'').slice(0,5000)),'text');return publish(result,'text');}
 case 'selection':return selection(!!args.enabled);
 case 'region':return chooseRegion();
 case 'screen-start':return startScreen();
 case 'screen-stop':stopScreen(true);return true;
 case 'screen-pause':return pauseScreen();
 case 'region-interact':return regionInteract(event.sender,args);
 case 'overlay':if(args.action==='invert'){persistSettings({...settings,textColor:settings.backgroundColor,backgroundColor:settings.textColor});return true;}else if(args.action==='toggle-original'){persistSettings({...settings,bilingual:!settings.bilingual});return settings.bilingual;}else if(args.action==='show'){showOverlay();}else if(args.action==='hide'){overlay?.hide();overlayVisible=false;send('overlay-state',false);}else if(args.action==='close'){overlay?.close();}else if(args.action==='preview'){showOverlay();lastOverlay={id:'preview',text:'Stay curious. Keep listening.',translation:'保持好奇，听见世界。',translations:targets(settings).map(target=>({target,translation:({zh:'保持好奇，听见世界。',en:'Stay curious. Keep listening.',ja:'好奇心を持ち、耳を傾けよう。',ko:'호기심을 갖고 계속 들어보세요.',fr:'Restez curieux. Continuez à écouter.',de:'Bleib neugierig. Hör weiter zu.',es:'Mantén la curiosidad. Sigue escuchando.',ru:'Сохраняйте любопытство. Продолжайте слушать.'})[target]}))};setTimeout(()=>overlay?.webContents.send('result',lastOverlay),200);}return overlayVisible;
 case 'overlay-backdrop-stopped':{if(fromOverlay&&!capturePolicy(settings).protected)overlay.setContentProtection(false);return true;}
 case 'overlay-backdrop':{if(!fromOverlay||!capturePolicy(settings).desktopBlur)return null;overlay.setContentProtection(true);const g=backdropGeometry();const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});const source=sources.find(s=>s.display_id===String(g.displayId));if(!source)throw new Error('未找到字幕所在屏幕');return {...g,sourceId:source.id};}
 case 'overlay-backdrop-error':{if(fromOverlay){persistSettings({...settings,backgroundBlur:false});fail(new Error('无法读取实时磨砂背景，已保留原有背景颜色与透明度。'));}return true;}
 case 'overlay-fit':if(Number.isFinite(args.height))overlayControl.fit(args.height,args.width);return true;
 case 'overlay-interact':if(args.action==='end')overlayControl.end();else if(args.point&&Number.isFinite(args.point.x)&&Number.isFinite(args.point.y)){if(args.action==='start')overlayControl.start(args.kind,args.point);else if(args.action==='move')overlayControl.move(args.point);}return true;
 case 'install-language':return rpc(command,{code:args.code,upgrade:!!args.upgrade},1800000);
 case 'install-speech':return rpc(command,{},1800000);
 case 'import-models':{const file=await dialog.showOpenDialog(main,{title:t('导入基础离线语言包'),properties:['openFile'],filters:[{name:t('Lishon 基础离线语言包'),extensions:['lishonpack']}]});if(file.canceled)return null;return rpc(command,{path:file.filePaths[0]},1800000);}
 case 'open-models':await shell.openPath(modelPath());return true;
 case 'choose-models':{if(pending.size)throw new Error('请等待当前翻译或下载完成后再更改目录');const value=await dialog.showOpenDialog(main,{properties:['openDirectory','createDirectory'],title:t('选择语言模型存储目录（原模型保留在原目录）')});if(value.canceled)return null;stopScreen();selection(false);preferences.modelPath=value.filePaths[0];save();rememberDataLocations();worker.kill();workerStart();return await rpc('status');}
 case 'windows-languages':await shell.openExternal('ms-settings:regionlanguage');return true;
 case 'audio':if(args.action==='arm'){const state=await rpc('status');if(!state.speech)throw new Error('当前模型目录缺少完整的语音识别包：'+state.path+'。请运行新版安装程序补齐，或在语言与模型导入基础离线包。');sessionHistory.end('audio');audioRecording=false;audioArmed=Date.now();audioEpoch++;ai.cancel('audio');captions=[];return true;}else if(args.action==='started'){audioRecording=true;sessionHistory.begin('audio');return true;}else if(args.action==='stop'){sessionHistory.end('audio');audioRecording=false;audioArmed=0;audioEpoch++;ai.cancel('audio');return true;}else {if(typeof args.audio!=='string'||args.audio.length>3000000)throw new Error('音频片段过大');const epoch=audioEpoch;const result=await translationRouter.transcribe({audio:args.audio,context:captions.filter(x=>x.origin==='audio'&&(settings.source==='auto'||x.source===settings.source)).map(x=>x.text).join(' ').slice(-240),source:settings.source,target:settings.target,targets:targets(settings)},{current:()=>epoch===audioEpoch});if(epoch===audioEpoch){for(const item of result.segments)publish(item,'audio');return result;}return {...result,segments:[]};}
 case 'import-media':{const file=await dialog.showOpenDialog(main,{title:t('翻译音频或视频'),properties:['openFile'],filters:[{name:t('音频与视频'),extensions:['wav','mp3','m4a','aac','ogg','flac','mp4','mkv','webm','mov']}]});if(file.canceled)return null;lastSegments=[];ai.cancel('file');const revision=aiRevision;const job='file-'+Date.now();activeFileJob=job;const result=await translationRouter.transcribe({path:file.filePaths[0],source:settings.source,target:settings.target,targets:targets(settings),job},{channel:'file',timeout:3600000,current:()=>revision===aiRevision&&activeFileJob===job,onSegment:segment=>send('segment',{job:'file',segment})});if(revision!==aiRevision)throw new Error('AI 配置已变更，请重新导入文件');lastSegments=result.segments;return {...result,name:path.basename(file.filePaths[0])};}
 case 'export-srt':{if(!lastSegments.length)throw new Error('请先导入并翻译音频或视频');const file=await dialog.showSaveDialog(main,{defaultPath:t('双语字幕.srt'),filters:[{name:t('SubRip 字幕'),extensions:['srt']}]});if(file.canceled)return false;fs.writeFileSync(file.filePath,srt(lastSegments),'utf8');return true;}
 case 'copy':clipboard.writeText(String(args.text||''));return true;
 case 'history-folder':{const chosen=await dialog.showOpenDialog(main,{title:t('选择历史记录存储位置'),properties:['openDirectory','createDirectory']});if(chosen.canceled)return null;const directory=path.join(chosen.filePaths[0],'Lishon-History');sessionHistory.configure(directory,!!args.enable||settings.historyEnabled);persistSettings({...settings,historyDirectory:directory,historyEnabled:!!args.enable||settings.historyEnabled});return sessionHistory.list();}
 case 'session-history':{const action=args.action||'list';if(action==='list')return sessionHistory.list();if(action==='delete')return sessionHistory.remove(Array.isArray(args.ids)?args.ids:[]);if(action==='rename')return sessionHistory.rename(args.id,args.name);if(action==='folder'){if(settings.historyDirectory)await shell.openPath(settings.historyDirectory);return true;}if(action==='open'){historyReader.open(args.id);return true;}if(action==='reveal'){shell.showItemInFolder(sessionHistory.resolve(args.id));return true;}throw Error('Unknown history action');}
 case 'clear-history':history=[];fs.writeFileSync(historyFile(),'[]');return true;
 case 'window':if(args.action==='refresh-theme'){main.webContents.invalidate();await main.webContents.capturePage();return true;}else if(args.action==='close-choice')return resolveMainClose(args);else if(args.action==='minimize')main.minimize();else if(args.action==='maximize'){main.isMaximized()?main.unmaximize():main.maximize();}else if(args.action==='close')main.close();return true;
 default:throw new Error('未知操作');
 }
}
ipcMain.handle('lingua',(event,command,args)=>reply(()=>handleCommand(event,command,args)));
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{main?.restore();main?.show();main?.focus();});
 app.whenReady().then(()=>{preferences=loadJson(dataFile(),{});let installerError;try{preferences=applyInstallerModelPath(app.getPath('userData'),preferences,app.isPackaged?path.dirname(app.getPath('exe')):undefined);}catch(e){installerError=e;}ai=createAI({directory:app.getPath('userData'),safeStorage,fetch:(...args)=>net.fetch(...args)});translationRouter=createTranslationRouter({ai,rpc});settings=cleanSettings(preferences);settings.aiEnabled=ai.enabled();settings.aiRevision=aiRevision;history=[];try{sessionHistory.configure(settings.historyDirectory,settings.historyEnabled);}catch(e){settings.historyEnabled=false;installerError=installerError||e;}rememberDataLocations();historyTimer=setInterval(()=>sessionHistory.tick(),1000);historyTimer.unref();workerStart();createMain();historyReader=createHistoryReader({getMain:()=>main,getSettings:()=>settings,history:sessionHistory,windowOptions,loadWindow});if(installerError)main.once('ready-to-show',()=>setTimeout(()=>fail(installerError),250));
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback((wc===overlay?.webContents&&permission==='media'&&capturePolicy(settings).desktopBlur)||wc===main?.webContents&&['media','display-capture'].includes(permission)&&Date.now()-audioArmed<30000));
 session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{if(Date.now()-audioArmed>30000){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen']});callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
 globalShortcut.register('CommandOrControl+Shift+L',()=>overlayVisible?(overlay?.hide(),overlayVisible=false,send('overlay-state',false)):showOverlay());
 });
 app.on('before-quit',()=>{quitting=true;clearInterval(historyTimer);sessionHistory.close();ai?.cancel();regionPicker?.kill();regionPicker=null;closeMarkers();overlayControl.stop();stopScreen();watcher?.kill();worker?.kill();globalShortcut.unregisterAll();});
 app.on('window-all-closed',()=>app.quit());
}
