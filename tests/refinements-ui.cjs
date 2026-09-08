// Browser plugin not available. Exercise the actual Electron renderer and IPC with an isolated profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{_electron}=require('playwright');
const {translate}=require('../shared/i18n.mjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.qa','refinements-070-'+Date.now()),profile=path.join(stage,'profile');fs.mkdirSync(profile,{recursive:true});
if(!process.env.LISHON_TEST_MODELS)throw Error('Set LISHON_TEST_MODELS to the installed offline model directory');
fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({modelPath:process.env.LISHON_TEST_MODELS,source:'en',target:'zh'}));
const env={...process.env,LINGUA_DATA_DIR:profile};delete env.LINGUA_DEV_URL;delete env.ELECTRON_RUN_AS_NODE;
const report={stage,layouts:[],errors:[]};let app;
(async()=>{try{
 app=await _electron.launch({executablePath:require('electron'),args:[root],env});const p=await app.firstWindow();p.on('pageerror',e=>report.errors.push(e.message));await p.waitForSelector('.main-nav');await p.waitForFunction(()=>!document.querySelector('.header-ai-toggle').disabled);
 assert.equal(await p.locator('.titlebar .brand').count(),0);assert.equal(await p.locator('.local-label').count(),0);assert.equal(await p.locator('.studio-credit').innerText(),'MAIS·AI Studio');
 const folder=path.join(stage,'历史 文件');fs.mkdirSync(folder);
 await app.evaluate(({dialog,shell},folder)=>{global.__opened=[];dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});shell.openPath=async f=>{global.__opened.push(f);return '';};shell.showItemInFolder=f=>global.__opened.push(f);},folder);
 await p.getByRole('button',{name:'我的语库',exact:true}).click();await p.getByRole('button',{name:'本地翻译历史',exact:true}).click();await p.getByRole('button',{name:'选择文件夹',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.history-storage').textContent.includes('Lishon-History'));
 await p.evaluate(()=>window.lingua.call('audio',{action:'arm'}));await p.evaluate(()=>window.lingua.call('audio',{action:'started'}));
 // Actual Whisper and local translation; only the audio input is a deterministic fixture.
 const audio=fs.readFileSync(path.join(__dirname,'fixtures/speech.wav')).toString('base64');const audioStart=Date.now();
 const result=await p.evaluate(audio=>window.lingua.call('audio',{audio}),audio);assert.ok(result.segments.length);
 if(Date.now()-audioStart<16000)await p.waitForTimeout(16000-(Date.now()-audioStart));
 await p.waitForFunction(()=>document.querySelectorAll('.session-history-list article').length===1);
 await p.evaluate(()=>window.lingua.call('audio',{action:'stop'}));
 const before=await p.evaluate(()=>window.lingua.call('session-history'));assert.equal(before.items.length,1);const savedFile=path.join(before.directory,before.items[0].file);assert.ok(fs.existsSync(savedFile));assert.match(fs.readFileSync(savedFile,'utf8'),/[\u4e00-\u9fff]/);
 await p.locator('.history-name').dblclick();await p.locator('.history-name-input').fill('会议记录');await p.locator('.history-name-input').press('Enter');await p.waitForFunction(()=>document.querySelector('.history-name')?.textContent==='会议记录');
 const readerReady=app.waitForEvent('window');await p.locator('.history-preview').dblclick();const reader=await readerReady;await reader.locator('.reader-document h1').waitFor();await reader.getByRole('button',{name:'关闭阅读面板',exact:true}).click();await p.getByRole('button',{name:'打开文件夹',exact:true}).last().click();assert.ok((await app.evaluate(()=>global.__opened)).includes(savedFile));
 await p.screenshot({path:path.join(stage,'history.png')});
 await p.getByRole('button',{name:'喜欢的单词',exact:true}).click();await p.getByRole('switch',{name:'实时翻译高亮收藏词',exact:true}).waitFor();if(await p.getByRole('switch',{name:'实时翻译高亮收藏词',exact:true}).getAttribute('aria-checked')==='false')await p.getByRole('switch',{name:'实时翻译高亮收藏词',exact:true}).click();
 await p.getByRole('button',{name:'收藏词高亮配色',exact:true}).click();await p.waitForTimeout(350);assert.equal(await p.locator('.library-index-card .favorite-colors').count(),1);const align=await p.locator('.favorite-colors').evaluate(n=>getComputedStyle(n).justifyContent);assert.equal(align,'flex-end');await p.screenshot({path:path.join(stage,'highlight.png')});
 for(const locale of ['zh','en','ja','ko','fr','ru']){
  await p.locator('.titlebar .interface-language select').selectOption(locale);await p.getByRole('button',{name:translate('划词翻译',locale),exact:true}).click();if(await p.locator('.editor-size-trigger').getAttribute('aria-expanded')==='false')await p.locator('.editor-size-trigger').click();
  for(const width of [1240,820])for(const theme of ['light','dark']){
   await app.evaluate(({BrowserWindow},{width})=>BrowserWindow.getAllWindows()[0].setSize(width,860),{width});await p.evaluate(theme=>window.lingua.call('settings',{theme}),theme);await p.waitForTimeout(220);
   const bad=await p.locator('.editor-size-panel button,.window-buttons button').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+2||n.getBoundingClientRect().right>innerWidth+1).map(n=>n.textContent));assert.deepEqual(bad,[],locale+' '+width+' '+theme);
   const line=await p.locator('.editor-size-panel button').first().evaluate(n=>({height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight)}));assert.ok(line.height<line.line*2+18,'Size label wraps');
   const colors=await p.locator('.interface-language select option').first().evaluate(n=>({bg:getComputedStyle(n).backgroundColor,fg:getComputedStyle(n).color}));assert.notEqual(colors.bg,colors.fg);report.layouts.push({locale,width,theme,colors});
   if(width===1240&&['en','ru'].includes(locale))await p.screenshot({path:path.join(stage,locale+'-'+theme+'.png')});
  }
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1240,860));await p.evaluate(()=>window.lingua.call('settings',{uiLanguage:'en'}));await p.getByRole('button',{name:'Settings',exact:true}).click();
 const alignments=await p.locator('.field-controls').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('.switch')).map(n=>({right:n.getBoundingClientRect().right,child:n.lastElementChild.getBoundingClientRect().right})));assert.ok(alignments.every(x=>Math.abs(x.right-x.child)<2));
 await p.getByRole('switch',{name:'Save translation history',exact:true}).click();assert.equal((await p.evaluate(()=>window.lingua.call('session-history'))).items.length,1);
 await p.getByRole('button',{name:'My library',exact:true}).click();await p.getByRole('button',{name:'Translation history',exact:true}).click();await p.getByRole('checkbox',{name:'Select records on this page',exact:true}).check();await p.getByRole('button',{name:/Delete selected/}).click();await p.waitForFunction(()=>document.querySelectorAll('.session-history-list article').length===0);assert.equal(fs.existsSync(savedFile),false);
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify({passed:true,layouts:report.layouts.length,history:'real speech, save, rename, open, disable preserves, bulk delete',stage}));
}finally{fs.writeFileSync(path.join(stage,'report.json'),JSON.stringify(report,null,2));if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
