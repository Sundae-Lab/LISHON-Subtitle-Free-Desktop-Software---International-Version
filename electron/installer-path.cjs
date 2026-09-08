const fs=require('node:fs'),path=require('node:path');
// The installer records only the chosen folder; the app preserves all other settings.
function applyInstallerModelPath(userData,preferences,installationRoot){
 const marker=path.join(userData,'installer-model-path.txt');
 const legacy=fs.existsSync(marker);
 let selected=legacy?fs.readFileSync(marker,'utf16le').replace(/^\uFEFF/,'').trim():null,installationId;
 const locationFile=installationRoot&&path.join(installationRoot,'lishon-model-location.json');
 if(locationFile&&fs.existsSync(locationFile)){
  const location=JSON.parse(fs.readFileSync(locationFile,'utf8').replace(/^\uFEFF/,''));
  if(location.version!==1||typeof location.id!=='string'||!location.id||typeof location.modelPath!=='string')throw new Error('安装时选择的语言包目录无效，请在语言与模型中重新选择。');
  if(location.id!==preferences.installerLocationId||!preferences.modelPath){selected=location.modelPath;installationId=location.id;}
 }
 if(selected===null)return preferences;
 if(!selected||!path.win32.isAbsolute(selected)||/[\0\r\n]/.test(selected))throw new Error('安装时选择的语言包目录无效，请在语言与模型中重新选择。');
 fs.mkdirSync(selected,{recursive:true});
 const next={...preferences,modelPath:selected,...(installationId?{installerLocationId:installationId}:{})};
 const file=path.join(userData,'settings.json'),temporary=path.join(userData,'settings.installer.tmp');
 fs.writeFileSync(temporary,JSON.stringify(next,null,2));
 fs.renameSync(temporary,file);
 if(legacy)fs.unlinkSync(marker);
 return next;
}
module.exports={applyInstallerModelPath};
