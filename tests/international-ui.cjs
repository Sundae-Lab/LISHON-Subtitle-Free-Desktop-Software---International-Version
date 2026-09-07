// Uses an isolated Electron profile and local inference. Never reads saved API credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require('playwright');
const {translate}=require('../shared/i18n.mjs');
const root=path.resolve(__dirname,'..'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'lishon-i18n-'));
const shots=process.env.LISHON_SCREENSHOTS||path.join(stage,'screenshots');fs.mkdirSync(shots,{recursive:true});
const data=path.join(stage,'profile');fs.mkdirSync(data);
if(!process.env.LISHON_TEST_MODELS)throw Error('Set LISHON_TEST_MODELS to a verified folder containing 14 translation pairs and Whisper Base. The source Python engine is used unless LISHON_ENGINE_EXE is set.');
fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({uiLanguage:'zh',source:'en',target:'zh',modelPath:process.env.LISHON_TEST_MODELS,history:false}));
const env={...process.env,LINGUA_DATA_DIR:data,LINGUA_DEV_URL:process.env.LISHON_UI_URL||'http://127.0.0.1:5197'};delete env.ELECTRON_RUN_AS_NODE;
const report={stage,shots,checks:[],errors:[],layout:[]};
const tr=(text,locale)=>translate(text,locale).trim();
(async()=>{
 const app=await _electron.launch({executablePath:require('electron'),args:[root],env});
 try{
  const p=await app.firstWindow();p.on('pageerror',e=>report.errors.push(e.message));
  await p.waitForSelector('.main-nav');await p.waitForFunction(()=>!document.querySelector('.header-ai-toggle').disabled);
  const initial=await p.evaluate(()=>window.lingua.call('bootstrap'));
  assert.equal(initial.models.speech,true);assert.equal(initial.models.pairs.length,14);
  const source='The meeting starts tomorrow. Please save this document.';
  await p.locator('#source-text').fill(source);
  await p.waitForFunction(()=>document.querySelector('.target-text')?.textContent?.includes('会议'));
  const originalTranslation=await p.locator('.target-text').innerText();
  const details=await p.evaluate(()=>window.lingua.call('lookup',{term:'curiosity',source:'en',target:'zh'}));
  for(const kind of ['favorite','word'])await p.evaluate(({kind,details})=>window.lingua.call('library',{action:'add',kind,term:'curiosity',source:'en',target:'zh',details}),{kind,details});
  await p.evaluate(()=>window.lingua.call('library',{action:'add',kind:'sentence',term:'The meeting starts tomorrow.',source:'en',target:'zh',details:{translation:'会议明天开始。'}}));
  const locales=['zh','en','ja','ko','fr','ru'];
  for(const locale of locales){
   await p.locator('.titlebar .interface-language select').selectOption(locale);
   await p.waitForFunction(locale=>document.documentElement.dataset.locale===locale,locale);
   await p.getByRole('button',{name:tr('划词翻译',locale),exact:true}).click();
   await p.getByRole('heading',{name:tr('划词翻译',locale),exact:true}).waitFor();
   assert.equal(await p.locator('#source-text').innerText(),source);assert.equal(await p.locator('.target-text').innerText(),originalTranslation);
   const saved=await p.evaluate(()=>window.lingua.call('bootstrap'));assert.equal(saved.settings.uiLanguage,locale);assert.equal(saved.settings.source,'en');assert.equal(saved.settings.target,'zh');
   const buttons=await p.locator('.window-buttons').evaluate(el=>[el.querySelector('.header-ai-toggle'),el.querySelector('.interface-language'),el.querySelector('.interface-language').nextElementSibling].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,right:b.right};}));assert.ok(buttons[0].right<=buttons[1].x&&buttons[1].right<=buttons[2].x);
   for(const [name,slug] of [['划词翻译','text'],['屏幕字幕','screen'],['实时听译','audio'],['我的语库','library'],['接入 AI','ai'],['语言与模型','models'],['设置','settings']]){
    await p.locator('nav').getByRole('button',{name:tr(name,locale),exact:true}).click();
    await p.getByRole('heading',{name:tr(name,locale),exact:true}).waitFor();await p.waitForTimeout(400);
    const bad=await p.locator('main').evaluate(el=>el.innerText.includes('[object Object]'));assert.equal(bad,false,locale+' '+slug+' interpolated React element');
    if(slug==='settings'){
     assert.equal(await p.locator('main .interface-language select').inputValue(),locale);
     await p.getByRole('switch',{name:tr('多语种翻译',locale),exact:true}).click();
     await p.getByRole('button',{name:tr('添加目标语种',locale),exact:true}).waitFor();
     await p.getByRole('switch',{name:tr('多语种翻译',locale),exact:true}).click();
    }
    if(['zh','en'].includes(locale)){await p.locator('main').evaluate(el=>el.scrollTo({top:0}));await p.waitForTimeout(150);await p.screenshot({path:path.join(slug==='models'?stage:shots,locale+'-'+slug+'.png')});}
    report.checks.push(locale+'/'+slug);
   }
   await p.locator('main .interface-language select').selectOption(locale==='en'?'fr':'en');
   assert.equal(await p.locator('.titlebar .interface-language select').inputValue(),locale==='en'?'fr':'en');
   await p.locator('.titlebar .interface-language select').selectOption(locale);
   await p.getByRole('button',{name:tr('关闭应用',locale),exact:true}).click();
   const dialog=p.locator('.close-dialog');await dialog.waitFor();assert.equal(await dialog.locator('h2').innerText(),tr('如何关闭听现？',locale));
   await dialog.getByRole('button',{name:tr('取消',locale),exact:true}).click();
   for(const width of [1240,820]){
    await app.evaluate(({BrowserWindow},{width})=>BrowserWindow.getAllWindows()[0].setSize(width,760),{width});
    for(const theme of ['light','dark']){
     await p.evaluate(theme=>window.lingua.call('settings',{theme}),theme);await p.waitForTimeout(450);
     const issues=await p.locator('.sidebar button,.window-buttons button,.interface-language').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.right>innerWidth+.5||r.x<-.5||n.scrollWidth>n.clientWidth+3;}).map(n=>n.textContent||n.getAttribute('aria-label')));
     report.layout.push({locale,width,theme,issues});assert.deepEqual(issues,[],locale+' '+width+' '+theme);
     if(width===820&&theme==='dark'&&['fr','ru'].includes(locale))await p.screenshot({path:path.join(stage,locale+'-narrow-dark.png')});
    }
   }
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1240,860));
   await p.evaluate(()=>window.lingua.call('settings',{theme:'light'}));
  }
  assert.deepEqual(report.errors,[]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data,'settings.json'))).uiLanguage,'ru');
  await p.reload();await p.waitForSelector('.main-nav');await p.waitForFunction(()=>document.documentElement.dataset.locale==='ru');
  report.checks.push('persist-after-reload');
  await p.evaluate(()=>window.lingua.call('settings',{uiLanguage:'en'}));
  await p.evaluate(()=>window.lingua.call('overlay',{action:'preview'}));
  let overlay;for(let i=0;i<40&&!overlay;i++){overlay=app.windows().find(w=>w.url().includes('view=overlay'));if(!overlay)await p.waitForTimeout(100);}
  assert.ok(overlay);await overlay.getByRole('button',{name:'Close subtitles',exact:true}).waitFor({state:'attached'});
  await p.evaluate(()=>window.lingua.call('settings',{uiLanguage:'fr'}));await overlay.getByRole('button',{name:'Fermer les sous-titres',exact:true}).waitFor({state:'attached'});
  report.checks.push('overlay-live-locale-sync');
  console.log(JSON.stringify({checks:report.checks.length,layoutStates:report.layout.length,errors:report.errors,stage,shots}));
 }finally{fs.writeFileSync(path.join(stage,'report.json'),JSON.stringify(report,null,2));await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
