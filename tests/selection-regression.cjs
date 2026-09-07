const {_electron:electron}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFile,spawn}=require('child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),env={...process.env,LINGUA_DATA_DIR:path.join(root,'.qa/revision-data'),LINGUA_DEV_URL:'',LINGUA_NATIVE_DEBUG:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({...process.env.LISHON_EXECUTABLE?{executablePath:process.env.LISHON_EXECUTABLE,args:[]}:{args:[root]},env});let browser,wpf;const report={};
 try{
  const page=await app.firstWindow();await page.getByText('引擎就绪',{exact:true}).waitFor({timeout:45000});
  await page.evaluate(()=>window.lingua.call('settings',{source:'en',target:'zh',multiTarget:true,subtitleTargets:[{code:'en',fontSize:34},{code:'zh',fontSize:26}]}));
  await page.evaluate(()=>{window.selectionEvidence=[];window.lingua.on('selection-text',x=>window.selectionEvidence.push(x));});
  await page.getByRole('switch',{name:'自动划词',exact:true}).click();
  browser=await electron.launch({args:[path.join(root,'tests/browser-fixture.cjs')],env:{...env,LINGUA_DATA_DIR:''}});
  const bp=await browser.firstWindow();await bp.locator('#sample').waitFor();
  const b=await bp.locator('#sample').boundingBox();
  const target=await browser.evaluate(({BrowserWindow,screen},b)=>{const w=BrowserWindow.getAllWindows()[0],c=w.getContentBounds();const start=screen.dipToScreenPoint({x:Math.round(c.x+b.x+2),y:Math.round(c.y+b.y+b.height/2)}),end=screen.dipToScreenPoint({x:Math.round(c.x+b.x+365),y:Math.round(c.y+b.y+b.height/2)});return {hwnd:w.getNativeWindowHandle().readBigUInt64LE().toString(),start,end};},b);
  const driver=path.join(root,'tests/input-driver/bin/Release/net10.0-windows/InputDriver.exe');
  const drag=t=>new Promise((resolve,reject)=>execFile(driver,[t.hwnd,String(t.start.x),String(t.start.y),String(t.end.x),String(t.end.y)],{windowsHide:true,timeout:10000},(e,out,err)=>e?reject(new Error(err||e.message)):resolve(out)));
  report.target=target;report.firstDrag=await drag(target);report.browserSelection=await bp.evaluate(()=>getSelection().toString());await bp.screenshot({path:path.join(root,'.qa/browser-selection.png')});assert.ok(report.browserSelection,'fixture must have an actual browser selection');
  await page.getByRole('textbox',{name:'原文',exact:true}).filter({visible:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('#source-text').innerText.includes('meeting'),{timeout:15000});
  await page.locator('.translated').filter({hasText:'会议'}).waitFor({timeout:45000});report.original=await page.getByRole('textbox',{name:'原文',exact:true}).innerText();report.translation=await page.locator('.translated').innerText();
  report.evidence=await page.evaluate(()=>window.selectionEvidence);assert.ok(report.evidence.length);
  await page.getByRole('button',{name:'清空原文和译文'}).click();
  report.secondDrag=await drag(target);await page.waitForFunction(()=>document.querySelector('#source-text').innerText.includes('meeting'),{timeout:15000});report.reselectAfterClear=true;
  wpf=spawn(path.join(root,'tests/wpf-selection/bin/Release/net10.0-windows/Fixture.exe'),[],{windowsHide:true});
  const wpfTarget=await new Promise((resolve,reject)=>{wpf.stdout.once('data',d=>{try{resolve(JSON.parse(String(d)));}catch(e){reject(e);}});wpf.once('error',reject);});
  report.wpfTarget=wpfTarget;await drag(wpfTarget);await page.waitForFunction(()=>document.querySelector('#source-text').innerText.includes('Welcome'),{timeout:15000});await page.locator('.translated').filter({hasText:'世界'}).waitFor({timeout:45000});report.wpf={original:await page.getByRole('textbox',{name:'原文',exact:true}).innerText(),translation:await page.locator('.translated').innerText()};
  wpf.kill();wpf=null;await page.getByRole('switch',{name:'自动划词',exact:true}).click();
  await page.getByRole('button',{name:'清空原文和译文'}).click();await drag(target);await page.waitForTimeout(900);assert.equal(await page.getByRole('textbox',{name:'原文',exact:true}).innerText(),'');report.disabledStopsCapture=true;
  fs.writeFileSync(path.join(root,'design/selection-regression.json'),JSON.stringify(report,null,2));console.log(report);
 }catch(e){fs.writeFileSync(path.join(root,'.qa/selection-partial.json'),JSON.stringify(report,null,2));report.errors=await app.windows()[0].locator('.error-banner').allTextContents();report.evidence=await app.windows()[0].evaluate(()=>window.selectionEvidence).catch(()=>[]);console.log(report);throw e;}finally{wpf?.kill();await browser?.close();await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
