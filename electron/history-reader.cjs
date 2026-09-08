const {BrowserWindow,screen,dialog}=require('electron');
const fs=require('node:fs');
const {historyExport}=require('../shared/history-document.mjs');
const {translate,localeTags}=require('../shared/i18n.mjs');
const {attachReader}=require('./reader-docking.cjs');
function createHistoryReader({getMain,getSettings,history,windowOptions,loadWindow}){
 let reader=null,id=null,originalBounds=null,placedBounds=null,exporting=false,docking=null;
 return {
  owns(sender){return reader&&!reader.isDestroyed()&&sender.id===reader.webContents.id;},
  open(recordId){history.read(recordId);id=recordId;if(reader&&!reader.isDestroyed()){reader.webContents.send('history-changed',{});reader.show();reader.focus();return;}
   const main=getMain(),b=main.getBounds(),area=screen.getDisplayMatching(b).workArea,width=Math.max(360,Math.min(540,Math.round(area.width*.34)));
   originalBounds=b;placedBounds=null;
   if(!main.isMaximized()&&!main.isFullScreen()&&area.width>=1180){const mainWidth=Math.max(820,Math.min(b.width,area.width-width));placedBounds={...b,width:mainWidth,x:Math.max(area.x,Math.min(b.x,area.x+area.width-mainWidth-width))};main.setBounds(placedBounds,false);placedBounds=main.getBounds();}
   const current=main.getBounds();reader=new BrowserWindow(windowOptions({width,height:current.height,minWidth:360,minHeight:360,frame:false,show:false,backgroundColor:getSettings().theme==='dark'?'#20241e':'#fdfefa',title:history.read(id).name}));docking=attachReader({main,reader,screen,width,height:current.height});loadWindow(reader,{view:'history'});reader.once('ready-to-show',()=>reader?.show());reader.webContents.setWindowOpenHandler(()=>({action:'deny'}));reader.webContents.on('will-navigate',e=>e.preventDefault());
   reader.on('enter-full-screen',()=>reader?.webContents.send('history-reader-state',{fullscreen:true}));reader.on('leave-full-screen',()=>reader?.webContents.send('history-reader-state',{fullscreen:false}));
   reader.on('closed',()=>{docking?.dispose();docking=null;reader=null;id=null;if(!main.isDestroyed()&&placedBounds&&['x','y','width','height'].every(key=>Math.abs(main.getBounds()[key]-placedBounds[key])<=2))main.setBounds(originalBounds,false);});
  },
  settings(s){if(reader&&!reader.isDestroyed()){reader.setBackgroundColor(s.theme==='dark'?'#20241e':'#fdfefa');reader.webContents.send('settings',s);}},
  changed(){if(reader&&!reader.isDestroyed()){if(!history.list().items.some(x=>x.id===id)){reader.close();return;}reader.setTitle(history.read(id).name);reader.webContents.send('history-changed',{});}},
  async command(args){if(!reader||reader.isDestroyed())throw Error('History reader is closed');
   if(args.action==='read')return {settings:getSettings(),document:history.read(id)};
   if(args.action==='close'){reader.close();return true;}
   if(args.action==='fullscreen'){const fullscreen=!reader.isFullScreen();if(fullscreen)docking?.beforeFullscreen();reader.setFullScreen(fullscreen);reader.webContents.send('history-reader-state',{fullscreen});return true;}
   if(args.action!=='export'||!['md','pdf'].includes(args.format)||!['paired','grouped'].includes(args.mode))throw Error('Invalid history reader action');
   if(exporting)throw Error('Export is already in progress');exporting=true;let printWindow;
   try{
    const doc=history.read(id),locale=getSettings().uiLanguage,t=s=>translate(s,locale),safeName=doc.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'History';
    const destination=await dialog.showSaveDialog(reader,{title:t('导出文档'),defaultPath:safeName+'.'+args.format,filters:[{name:args.format==='pdf'?'PDF':'Markdown',extensions:[args.format]}]});if(destination.canceled)return false;
    const label=code=>{if(!code||code==='auto')return t('识别语言');try{return new Intl.DisplayNames([localeTags[locale]||'en'],{type:'language'}).of(code);}catch{return code;}};
    const options={mode:args.mode,label,original:t('原文'),showLabels:args.showLabels!==false};
    if(args.format==='md'){fs.writeFileSync(destination.filePath,historyExport(doc,{...options,format:'md'}),'utf8');}
    else{printWindow=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await printWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(historyExport(doc,{...options,format:'html'})));await printWindow.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');const pdf=await printWindow.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,generateTaggedPDF:true});fs.writeFileSync(destination.filePath,pdf);}
    return true;
   }finally{printWindow?.destroy();exporting=false;}
  }
 };
}
module.exports={createHistoryReader};
