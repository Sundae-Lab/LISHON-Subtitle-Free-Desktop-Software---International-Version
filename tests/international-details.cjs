// Secondary panels use an isolated source-build profile and local models only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require('playwright'),{translate}=require('../shared/i18n.mjs');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'lishon-details-')),root=path.resolve(__dirname,'..');
if(!process.env.LISHON_TEST_MODELS)throw Error('Set LISHON_TEST_MODELS to a prepared local model folder.');
fs.writeFileSync(path.join(stage,'settings.json'),JSON.stringify({uiLanguage:'en',modelPath:process.env.LISHON_TEST_MODELS,source:'en',target:'zh'}));
const env={...process.env,LINGUA_DATA_DIR:stage,LINGUA_DEV_URL:process.env.LISHON_TEST_FILE_MODE?'':process.env.LISHON_UI_URL||'http://127.0.0.1:5197'};delete env.ELECTRON_RUN_AS_NODE;
(async()=>{
 const app=await _electron.launch({executablePath:require('electron'),args:[root],env});let checks=0;
 try{
  const p=await app.firstWindow();await p.waitForSelector('.main-nav');await p.waitForFunction(()=>!document.querySelector('.header-ai-toggle').disabled);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.evaluate(()=>window.lingua.call('library',{action:'add',kind:'sentence',term:'A new beginning.',source:'en',target:'zh',details:{translation:'新的开始。'}}));
  for(const locale of ['en','ja','ko','fr','ru']){
   const tr=key=>translate(key,locale).trim();
   await p.locator('.titlebar .interface-language select').selectOption(locale);
   await p.getByRole('button',{name:tr('设置'),exact:true}).click();
   await p.getByRole('switch',{name:tr('多语种翻译'),exact:true}).click();
   await p.locator('.target-row .palette-trigger').first().click();
   await p.locator('.palette-popover').waitFor();
   assert.equal(await p.locator('.palette-popover button').count(),23);
   const label=await p.locator('.palette-popover').getAttribute('aria-label');
   if(locale==='en'||locale==='fr'||locale==='ru')assert.ok(!/[\u3400-\u9fff]/.test(label));
   await p.keyboard.press('Escape');
   await p.getByRole('switch',{name:tr('多语种翻译'),exact:true}).click();checks++;
   await p.getByRole('button',{name:tr('我的语库'),exact:true}).click();
   for(const tab of ['喜欢的单词','单词卡片','句子卡片']){
    await p.getByRole('button',{name:tr(tab),exact:true}).click();
    await p.getByRole('button',{name:tr('筛选译文语种'),exact:true}).click();
    await p.getByRole('group',{name:tr('译文语种筛选'),exact:true}).waitFor();
    await p.getByRole('button',{name:tr('筛选译文语种'),exact:true}).click();checks++;
   }
   await p.locator('.language-badge').waitFor();assert.equal(await p.locator('.language-badge').first().innerText(),'ZH');checks++;
   // Tooltips and accessible names must switch too. Native language autonyms remain intentional.
   const attributes=await p.locator('button,input,[title],[aria-label]').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).flatMap(n=>['title','aria-label','placeholder'].map(a=>n.getAttribute(a)).filter(Boolean)));
   if(['en','fr','ru'].includes(locale))assert.deepEqual(attributes.filter(s=>/[\u3400-\u9fff]/.test(s)),[]);
  }
  await p.locator('.titlebar .interface-language select').selectOption('en');
  await p.getByRole('button',{name:'Text translation',exact:true}).click();
  await p.locator('#source-text').fill('The meeting starts tomorrow.');
  await p.waitForFunction(()=>document.querySelector('.target-text')?.textContent?.includes('会议'));
  await p.locator('.target-text .word-token').first().click();
  await p.getByRole('dialog',{name:'Dictionary definitions',exact:true}).waitFor();
  await p.getByRole('button',{name:'Close dictionary',exact:true}).click();checks++;
  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors,stage}));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
