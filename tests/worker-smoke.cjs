const {spawn}=require('node:child_process');const path=require('node:path');
const p=spawn(path.resolve('.venv/Scripts/python.exe'),['-u','engine/service.py',path.join(process.env.APPDATA,'lingua-desktop/models')],{env:{...process.env,LINGUA_DEBUG:'1'}});
p.stdout.on('data',data=>{console.log(String(data));if(String(data).includes('"id": 1')){p.stdin.end();}});p.stderr.on('data',data=>console.error(String(data)));
p.stdin.write(JSON.stringify({id:1,command:'translate',args:{text:'Hello world.',source:'en',target:'zh'}})+'\n');setTimeout(()=>p.kill(),20000).unref();
