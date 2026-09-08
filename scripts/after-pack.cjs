const fs=require('node:fs'),path=require('node:path');
// Record application-owned files only. Models added by the installer are deliberately absent.
module.exports=async ({appOutDir})=>{
 const files=[],directories=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name),relative=path.relative(appOutDir,full).split(path.sep).join('/');
  if(entry.isDirectory()){directories.push(relative);walk(full);}else if(entry.isFile())files.push(relative);
 }}
 walk(appOutDir);
 for(const name of ['lishon-install-files.json','lishon-model-location.json'])if(!files.includes(name))files.push(name);
 fs.writeFileSync(path.join(appOutDir,'lishon-install-files.json'),JSON.stringify({version:1,files:files.sort(),directories:directories.sort()},null,2));
};
