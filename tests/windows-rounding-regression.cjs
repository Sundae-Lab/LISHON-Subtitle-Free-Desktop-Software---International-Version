// Windows compositor regression. Uses isolated settings, a checkerboard fixture and external GDI captures.
const assert=require('node:assert/strict');const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{_electron}=require('playwright');
const executable=process.env.LISHON_TEST_EXE;if(!executable)throw new Error('Set LISHON_TEST_EXE to the packaged Lishon.exe.');
const stage=fs.mkdtempSync(path.join(require('os').tmpdir(),'lishon-rounding-'));console.log('Evidence directory:',stage);
const data=path.join(stage,'data');fs.mkdirSync(data,{recursive:true});
const old={source:'en',target:'zh',fontSize:28,textColor:'#ffffff',modelPath:path.join(stage,'models')};
fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({...old,allowSubtitleCapture:true,backgroundEnabled:true,backgroundBlur:true,backgroundColor:'#000000',opacityLevel:1,multiTarget:false,lines:1,bilingual:true,modelPath:old.modelPath||path.join(process.env.APPDATA,'lingua-desktop/models')}));
const env={...process.env,LINGUA_DATA_DIR:data,LINGUA_DEV_URL:'',LISHON_MATERIAL_DEBUG:path.join(stage,'material.log')};delete env.ELECTRON_RUN_AS_NODE;
(async()=>{const app=await _electron.launch({executablePath:executable,args:[],env});try{
 const page=await app.firstWindow();await page.waitForSelector('.main-nav');await page.evaluate(()=>window.lingua.call('bootstrap'));await page.evaluate(()=>window.lingua.call('overlay',{action:'preview'}));await new Promise(r=>setTimeout(r,1000));
 const hwnd=await app.evaluate(async({BrowserWindow,screen})=>{const overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=overlay')),d=screen.getAllDisplays().find(d=>d.bounds.x!==0)||screen.getPrimaryDisplay();const fixture=new BrowserWindow({x:d.bounds.x,y:d.bounds.y,width:d.bounds.width,height:d.bounds.height,frame:false,show:false,webPreferences:{sandbox:true}});await fixture.loadURL('data:text/html,'+encodeURIComponent('<body style="margin:0;height:100vh;background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0/12px 12px"></body>'));fixture.showInactive();overlay.setBounds({x:d.bounds.x,y:d.bounds.y+120,width:760,height:170},false);overlay.showInactive();global.roundOverlay=overlay;return overlay.getNativeWindowHandle().readBigUInt64LE().toString();});

 async function shot(name,reference){const args=['-NoProfile','-File',path.join(__dirname,'windows-rounding-capture.ps1'),'-WindowHandle',hwnd,'-OutputPath',path.join(stage,name+'.png')];if(reference)args.push('-ReferencePath',path.join(stage,reference+'.png'));return JSON.parse(execFileSync('powershell.exe',args,{encoding:'utf8',windowsHide:true}));}
 async function check(name){await new Promise(r=>setTimeout(r,400));await app.evaluate(()=>global.roundOverlay.hide());await new Promise(r=>setTimeout(r,180));await shot(name+'-baseline');await app.evaluate(()=>global.roundOverlay.showInactive());await new Promise(r=>setTimeout(r,250));const report=await shot(name,name+'-baseline');assert.equal(report.unblurredCorners,true,name+' has blur outside the rounded corners');if(['text-only','blur-off','opacity-10'].includes(name))assert.deepEqual(report.cornerDifferences,[0,0,0,0],name+' has pixels outside rounded corners');assert.equal(report.affinity,0);console.log('PASS',name,JSON.stringify(report));}
 await check('native-clear');
 for(const level of [5,10]){await page.evaluate(level=>window.lingua.call('settings',{opacityLevel:level}),level);await check('opacity-'+level);}
 await page.evaluate(()=>window.lingua.call('settings',{backgroundBlur:false,opacityLevel:5}));await check('blur-off');
 await page.evaluate(()=>window.lingua.call('settings',{backgroundBlur:true}));await check('blur-on');
 await page.evaluate(()=>window.lingua.call('settings',{backgroundEnabled:false}));await check('text-only');
 await page.evaluate(()=>window.lingua.call('settings',{backgroundEnabled:true,opacityLevel:1}));
 for(const widthLevel of [1,4,10,15,20]){await page.evaluate(widthLevel=>window.lingua.call('settings',{widthLevel}),widthLevel);await check('width-'+widthLevel);}
 for(const bilingual of [false,true]){await page.evaluate(bilingual=>window.lingua.call('settings',{bilingual}),bilingual);await check('original-'+bilingual);}
 const overlay=app.windows().find(w=>w.url().includes('view=overlay'));assert.equal(await overlay.locator('.overlay-shell').evaluate(e=>getComputedStyle(e).borderTopLeftRadius),'8px');
 await page.evaluate(()=>window.lingua.call('settings',{widthLevel:4}));await new Promise(r=>setTimeout(r,400));
 const before=await app.evaluate(()=>global.roundOverlay.getBounds());await overlay.evaluate(async b=>{await window.lingua.call('overlay-interact',{action:'start',kind:'move',point:{x:b.x+100,y:b.y+12}});for(let i=1;i<=30;i++)await window.lingua.call('overlay-interact',{action:'move',point:{x:b.x+100+i,y:b.y+12+i}});await window.lingua.call('overlay-interact',{action:'end'});},before);const after=await app.evaluate(()=>global.roundOverlay.getBounds());assert.equal(after.width,before.width);assert.ok(Math.abs(after.height-before.height)<=1,'movement amplified DPI rounding');console.log('DRAG BOUNDS',JSON.stringify({before,after}));await check('after-drag');
 await page.evaluate(()=>window.lingua.call('settings',{allowSubtitleCapture:false,widthLevel:4,blurLevel:10}));await new Promise(r=>setTimeout(r,1000));assert.equal(await overlay.locator('video').count(),1);
 await page.evaluate(()=>window.lingua.call('settings',{allowSubtitleCapture:true}));await check('after-precise-mode');assert.equal(await overlay.locator('video').count(),0);
 console.log('ALL CORNER AND MOVEMENT CHECKS PASSED');

 }finally{await app.evaluate(({app})=>app.quit());}})().catch(e=>{console.error(e);process.exitCode=1});
