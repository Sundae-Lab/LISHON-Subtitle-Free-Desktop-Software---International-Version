// Launch the installed EXE with a clean profile: discovery must come from the install's location record.
const { _electron }=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const executablePath=process.env.LISHON_TEST_EXE,expectedModels=process.env.LISHON_TEST_MODELS,stage=process.env.LISHON_INSTALL_STAGE;
if(!executablePath||!expectedModels||!stage)throw Error('Set LISHON_TEST_EXE, LISHON_TEST_MODELS and LISHON_INSTALL_STAGE to isolated installation fixtures.');
fs.mkdirSync(stage,{recursive:true});const profile=path.join(stage,'profile');fs.mkdirSync(profile,{recursive:true});
const env={...process.env,LINGUA_DATA_DIR:profile};
for(const key of ['ELECTRON_RUN_AS_NODE','LINGUA_DEV_URL','LISHON_ENGINE_EXE','LISHON_NATIVE_EXE'])delete env[key];
const normalized=p=>path.resolve(p).toLowerCase();
const samples={zh:'备份已完成。',ja:'バックアップが完了しました。',ko:'백업이 완료되었습니다.',fr:'La sauvegarde est terminée.',de:'Das Backup ist abgeschlossen.',es:'La copia de seguridad está completa.',ru:'Резервное копирование завершено.'};
(async()=>{
 const report={executablePath,expectedModels,translations:[],errors:[]};
 let app;
 try{
  app=await _electron.launch({executablePath,env,args:[]});const p=await app.firstWindow();
  p.on('pageerror',e=>report.errors.push(e.message));await p.waitForSelector('.main-nav');
  await p.waitForFunction(()=>!document.querySelector('.header-ai-toggle').disabled);
  const bootstrap=await p.evaluate(()=>window.lingua.call('bootstrap'));
  assert.equal(normalized(bootstrap.models.path),normalized(expectedModels));assert.equal(bootstrap.models.pairs.length,14);assert.equal(bootstrap.models.speech,true);assert.equal(bootstrap.settings.aiEnabled,false);
  const location=JSON.parse(fs.readFileSync(path.join(path.dirname(executablePath),'lishon-model-location.json'),'utf8'));
  let preferences=JSON.parse(fs.readFileSync(path.join(profile,'settings.json'),'utf8'));assert.equal(preferences.installerLocationId,location.id);
  for(const [code,text] of Object.entries(samples))for(const [source,target,input] of [['en',code,'The backup is complete.'],[code,'en',text]]){
   await p.evaluate(({source,target})=>window.lingua.call('settings',{source,target}),{source,target});
   const result=await p.evaluate(text=>window.lingua.call('translate',{text}),input);
   assert.ok(result.translation?.trim(),source+' -> '+target);report.translations.push({source,target,text:result.translation});
  }
  await p.evaluate(()=>window.lingua.call('settings',{source:'en',target:'zh'}));
  await p.locator('#source-text').fill('The meeting starts tomorrow.');
  await p.waitForFunction(()=>document.querySelector('.target-text')?.textContent?.includes('会议'));
  for(const locale of ['zh','en','ja','ko','fr','ru']){
   await p.locator('.titlebar .interface-language select').selectOption(locale);
   await p.waitForFunction(locale=>document.documentElement.dataset.locale===locale,locale);
  }
  await p.locator('.titlebar .interface-language select').selectOption('zh');
  await p.screenshot({path:path.join(stage,'installed-ui.png')});
  await app.evaluate(({dialog},fixture)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});},path.resolve(__dirname,'fixtures/speech.wav'));
  const speech=await p.evaluate(()=>window.lingua.call('import-media'));
  assert.ok(speech.segments.some(s=>s.text&&/[\u4e00-\u9fff]/.test(s.translation)));report.speech=speech.segments;
  await app.close();app=null;
  preferences=JSON.parse(fs.readFileSync(path.join(profile,'settings.json'),'utf8'));assert.equal(preferences.installerLocationId,location.id);
  app=await _electron.launch({executablePath,env,args:[]});const reopened=await app.firstWindow();await reopened.waitForSelector('.main-nav');
  const after=await reopened.evaluate(()=>window.lingua.call('bootstrap'));assert.equal(normalized(after.models.path),normalized(expectedModels));assert.equal(after.models.speech,true);assert.equal(after.models.pairs.length,14);
  assert.deepEqual(report.errors,[]);report.restarted=true;report.passed=true;
  console.log(JSON.stringify({passed:true,translationDirections:report.translations.length,speechSegments:report.speech.length,restart:true,stage}));
 }finally{fs.writeFileSync(path.join(stage,'runtime-report.json'),JSON.stringify(report,null,2));if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
