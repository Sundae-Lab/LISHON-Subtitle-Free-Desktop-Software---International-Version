// Compress weights losslessly before embedding in the single offline NSISBI installer.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {getPath7za}=require('app-builder-lib/out/toolsets/7zip');
(async()=>{
 const root=path.resolve(__dirname,'..'),archive=path.join(root,'build/bundled-models.7z');
 const temporary=archive+'.tmp.7z';
 if(fs.existsSync(temporary))fs.unlinkSync(temporary);
 const result=spawnSync(await getPath7za(),['a','-t7z',temporary,'.','-m0=LZMA2','-mx=7','-md=64m','-ms=on','-mmt=4'],{cwd:path.join(root,'build/bundled-models'),stdio:'inherit',windowsHide:true});
 if(result.status!==0)throw new Error('Bundled model compression failed');
 fs.renameSync(temporary,archive);
 console.log('Lossless model archive bytes:',fs.statSync(archive).size);
})().catch(e=>{console.error(e);process.exitCode=1;});
