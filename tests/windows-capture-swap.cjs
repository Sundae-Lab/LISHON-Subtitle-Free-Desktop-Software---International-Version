// Real packaged UI, desktop OCR and system-loopback speech; all inference stays local.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron}=require('playwright');
const exec=promisify(execFile),stage=process.env.LISHON_CAPTURE_STAGE;
if(!stage)throw Error('Set LISHON_CAPTURE_STAGE to an isolated evidence directory');
const data=path.join(stage,'capture-profile');fs.mkdirSync(data,{recursive:true});
const models=process.env.LISHON_TEST_MODELS;
if(!models)throw Error('Set LISHON_TEST_MODELS to a prepared model folder.');
const legacy=path.join(models,'speech');
if(fs.existsSync(legacy))fs.cpSync(legacy,path.join(data,'models/speech'),{recursive:true});
fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({source:'en',target:'zh',multiTarget:true,subtitleTargets:[{code:'zh',fontSize:28}],modelPath:models,chunkSeconds:4,backgroundBlur:false}));
const env={...process.env,LINGUA_DATA_DIR:data,LINGUA_DEV_URL:''};delete env.ELECTRON_RUN_AS_NODE;
async function until(check,timeout=45000){const end=Date.now()+timeout;while(!await check()){if(Date.now()>end)throw Error('Timed out waiting for capture evidence');await new Promise(r=>setTimeout(r,150));}}
(async()=>{
 const app=await _electron.launch({executablePath:process.env.LISHON_TEST_EXE||path.join(stage,'app/Lishon.exe'),env,args:[]});
 try{
  const p=await app.firstWindow(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.waitForSelector('.main-nav');const bootstrap=await p.evaluate(()=>window.lingua.call('bootstrap'));
  assert.equal(bootstrap.models.pairs.length,14);assert.equal(bootstrap.models.speech,true);
  assert.equal(bootstrap.models.path.replaceAll('\\','/'),models.replaceAll('\\','/'));
  await p.evaluate(()=>{window.captureEvidence=[];window.lingua.on('result',r=>window.captureEvidence.push(r));});
  await app.evaluate(async({BrowserWindow})=>{
   const main=BrowserWindow.getAllWindows()[0];main.setBounds({x:950,y:260,width:1240,height:860});
   const fixture=new BrowserWindow({x:70,y:140,width:800,height:130,frame:false,alwaysOnTop:true,webPreferences:{contextIsolation:true}});
   fixture.setTitle('Lishon capture fixture');
   await fixture.loadURL('data:text/html,'+encodeURIComponent('<body style="margin:18px;background:white;color:black;font:32px Arial"><p id="sample" style="margin:0">The meeting starts tomorrow.</p><audio id="voice"></audio></body>'));
   globalThis.captureFixture=fixture;fixture.showInactive();
  });
  const region=await app.evaluate(({screen})=>{const b=globalThis.captureFixture.getContentBounds();const a=screen.dipToScreenPoint({x:b.x+4,y:b.y+4}),z=screen.dipToScreenPoint({x:b.x+b.width-4,y:b.y+90});return {a,z};});
  await p.getByRole('button',{name:'屏幕字幕',exact:true}).click();
  assert.equal(await p.locator('.notice:visible').count(),0);
  await p.getByRole('button',{name:'开始选框',exact:true}).click();
  await exec('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-pick-fixture.ps1'),String(region.a.x),String(region.a.y),String(region.z.x),String(region.z.y)],{windowsHide:true});
  await until(()=>p.evaluate(async()=>!!(await window.lingua.call('bootstrap')).screenState.region));
  await p.getByRole('button',{name:'开始翻译',exact:true}).click();
  await until(()=>p.evaluate(()=>window.captureEvidence.some(r=>r.origin==='screen'&&/meeting/i.test(r.text)&&/[\u4e00-\u9fff]/.test(r.translation))));
  const before=await p.evaluate(async()=>(await window.lingua.call('bootstrap')).screenState.region);
  await p.locator('.capture-workspace:visible').getByRole('button',{name:'交换语言',exact:true}).click();
  await app.evaluate(()=>globalThis.captureFixture.webContents.executeJavaScript("document.querySelector('#sample').textContent='会议明天开始。'"));
  await until(()=>p.evaluate(()=>window.captureEvidence.some(r=>r.origin==='screen'&&r.source==='zh'&&r.target==='en'&&/meeting|conference/i.test(r.translation))));
  let state=await p.evaluate(()=>window.lingua.call('bootstrap'));assert.equal(state.screenState.active,true);assert.deepEqual(state.screenState.region,before);
  await p.getByRole('button',{name:'暂停翻译',exact:true}).click();
  await p.locator('.capture-workspace:visible').getByRole('button',{name:'交换语言',exact:true}).click();
  state=await p.evaluate(()=>window.lingua.call('bootstrap'));assert.equal(state.screenState.paused,true);assert.deepEqual(state.screenState.region,before);
  await p.screenshot({path:path.join(stage,'screen-swap.png')});
  await p.getByRole('button',{name:'停止翻译',exact:true}).click();
  await p.getByRole('button',{name:'实时听译',exact:true}).click();
  assert.equal(await p.locator('.notice:visible').count(),0);
  await p.getByRole('button',{name:'开始听译',exact:true}).click();
  await p.getByRole('button',{name:'停止听译',exact:true}).waitFor();
  async function play(file){const base64=fs.readFileSync(file).toString('base64');await app.evaluate((_,wav)=>globalThis.captureFixture.webContents.executeJavaScript(`document.querySelector('#voice').src='data:audio/wav;base64,${wav}';document.querySelector('#voice').play()`),base64);}
  await play(path.join(__dirname,'fixtures/speech.wav'));
  await until(()=>p.evaluate(()=>window.captureEvidence.some(r=>r.origin==='audio'&&r.source==='en'&&/[\u4e00-\u9fff]/.test(r.translation))),60000);
  await p.locator('.capture-workspace:visible').getByRole('button',{name:'交换语言',exact:true}).click();
  assert.equal(await p.getByRole('button',{name:'停止听译',exact:true}).count(),1);
  await play(path.join(stage,'chinese.wav'));
  await until(()=>p.evaluate(()=>window.captureEvidence.some(r=>r.origin==='audio'&&r.source==='zh'&&r.target==='en'&&/[\u4e00-\u9fff]/.test(r.text)&&/[a-z]/i.test(r.translation))),60000);
  await p.getByRole('button',{name:'停止听译',exact:true}).click();
  await p.screenshot({path:path.join(stage,'audio-swap.png')});
  assert.deepEqual(errors,[]);assert.equal(await p.getByRole('alert').count(),0);
  const evidence=await p.evaluate(()=>window.captureEvidence);fs.writeFileSync(path.join(stage,'capture-evidence.json'),JSON.stringify(evidence,null,2));
  console.log('PASS installed directory + speech recovery, real OCR en/zh swaps, preserved region/active/pause, real system-loopback Whisper en/zh swaps and local subtitle output');
 }finally{await app.evaluate(({app})=>app.quit());}
})().catch(e=>{console.error(e);process.exitCode=1;});
