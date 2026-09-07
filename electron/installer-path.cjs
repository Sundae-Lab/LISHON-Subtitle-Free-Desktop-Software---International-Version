const fs=require('node:fs'),path=require('node:path');
// The installer records only the chosen folder; the app preserves all other settings.
function applyInstallerModelPath(userData,preferences){
 const marker=path.join(userData,'installer-model-path.txt');
 if(!fs.existsSync(marker))return preferences;
 const selected=fs.readFileSync(marker,'utf16le').replace(/^\uFEFF/,'').trim();
 if(!selected||!path.win32.isAbsolute(selected)||/[\0\r\n]/.test(selected))throw new Error('安装时选择的语言包目录无效，请在语言与模型中重新选择。');
 fs.mkdirSync(selected,{recursive:true});
 const next={...preferences,modelPath:selected};
 const file=path.join(userData,'settings.json'),temporary=path.join(userData,'settings.installer.tmp');
 fs.writeFileSync(temporary,JSON.stringify(next,null,2));
 fs.renameSync(temporary,file);
 fs.unlinkSync(marker);
 return next;
}
module.exports={applyInstallerModelPath};
