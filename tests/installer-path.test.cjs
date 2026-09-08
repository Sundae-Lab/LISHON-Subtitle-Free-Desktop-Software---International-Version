const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {applyInstallerModelPath}=require('../electron/installer-path.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lishon-model-test-'));t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});const data=path.join(root,'data');fs.mkdirSync(data);return {root,data,marker:path.join(data,'installer-model-path.txt')};}
test('upgrade without a model choice preserves settings and writes nothing',t=>{const f=fixture(t),old={theme:'dark',modelPath:'D:\\Existing models'};assert.equal(applyInstallerModelPath(f.data,old),old);assert.deepEqual(fs.readdirSync(f.data),[]);});
test('installer folder choice is applied once, preserving settings and model files',t=>{const f=fixture(t),chosen=path.join(f.root,'语言包'),old={theme:'dark',fontSize:33,modelPath:path.join(f.root,'old-models')};fs.mkdirSync(chosen);fs.writeFileSync(path.join(chosen,'existing-model.bin'),'keep');fs.writeFileSync(path.join(f.data,'settings.json'),JSON.stringify(old));fs.writeFileSync(f.marker,'\ufeff'+chosen,'utf16le');const next=applyInstallerModelPath(f.data,old);assert.deepEqual(next,{...old,modelPath:chosen});assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.data,'settings.json'),'utf8')),next);assert.equal(fs.readFileSync(path.join(chosen,'existing-model.bin'),'utf8'),'keep');assert.equal(fs.existsSync(f.marker),false);assert.equal(applyInstallerModelPath(f.data,next),next);});
test('NSIS UTF16 without BOM creates the chosen model folder',t=>{const f=fixture(t),chosen=path.join(f.root,'new models');fs.writeFileSync(f.marker,chosen,'utf16le');assert.equal(applyInstallerModelPath(f.data,{}).modelPath,chosen);assert.ok(fs.statSync(chosen).isDirectory());});
test('invalid installer paths never replace existing preferences',t=>{const f=fixture(t),file=path.join(f.data,'settings.json');fs.writeFileSync(file,'{"theme":"dark"}');fs.writeFileSync(f.marker,'relative-folder','utf16le');assert.throws(()=>applyInstallerModelPath(f.data,{theme:'dark'}),/无效/);assert.equal(fs.readFileSync(file,'utf8'),'{"theme":"dark"}');assert.ok(fs.existsSync(f.marker));});

for(const arrangement of ['same','nested','separate'])test(`installation-local location works for ${arrangement} Unicode folders and new profiles`,t=>{
 const f=fixture(t),appDir=path.join(f.root,'应用 软件'),chosen=arrangement==='same'?appDir:arrangement==='nested'?path.join(appDir,'语言 模型'):path.join(f.root,'独立 模型');
 fs.mkdirSync(appDir,{recursive:true});fs.mkdirSync(chosen,{recursive:true});fs.writeFileSync(path.join(chosen,'keep.bin'),'model');
 fs.writeFileSync(path.join(appDir,'lishon-model-location.json'),JSON.stringify({version:1,id:'install-1',modelPath:chosen}));
 const next=applyInstallerModelPath(f.data,{uiLanguage:'fr',theme:'dark'},appDir);
 assert.equal(next.modelPath,chosen);assert.equal(next.installerLocationId,'install-1');assert.equal(next.uiLanguage,'fr');
 assert.equal(fs.readFileSync(path.join(chosen,'keep.bin'),'utf8'),'model');
 const changed={...next,modelPath:path.join(f.root,'user choice')};
 assert.deepEqual(applyInstallerModelPath(f.data,changed,appDir),changed,'later in-app choice must survive restart');
 fs.writeFileSync(path.join(appDir,'lishon-model-location.json'),JSON.stringify({version:1,id:'install-2',modelPath:chosen}));
 assert.equal(applyInstallerModelPath(f.data,changed,appDir).modelPath,chosen,'a new installation choice should apply once');
});

test('invalid installation-local metadata leaves the profile intact',t=>{
 const f=fixture(t),appDir=path.join(f.root,'app');fs.mkdirSync(appDir);
 fs.writeFileSync(path.join(appDir,'lishon-model-location.json'),JSON.stringify({version:1,id:'x',modelPath:'relative'}));
 assert.throws(()=>applyInstallerModelPath(f.data,{uiLanguage:'ru'},appDir),/无效/);
 assert.equal(fs.existsSync(path.join(f.data,'settings.json')),false);
});
