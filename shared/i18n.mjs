import catalog from './messages.json' with {type:'json'};
export const interfaceLanguages=[{code:'zh',name:'中文'},{code:'en',name:'English'},{code:'ja',name:'日本語'},{code:'ko',name:'한국어'},{code:'fr',name:'Français'},{code:'ru',name:'Русский'}];
export const localeTags={zh:'zh-CN',en:'en-US',ja:'ja-JP',ko:'ko-KR',fr:'fr-FR',ru:'ru-RU'};
export function normalizeLocale(value){return Object.hasOwn(localeTags,value)?value:'zh';}
function interpolate(message,values={}){return message.replace(/\{(\d+)\}/g,(match,key)=>String(values[key]??match));}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.keys(catalog).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length).map(key=>{
 const names=[];const pattern=key.split(/(\{\d+\})/).map(part=>{const m=/^\{(\d+)\}$/.exec(part);if(m){names.push(m[1]);return '([\\s\\S]*?)';}return escape(part);}).join('');
 return {key,names,re:new RegExp('^'+pattern+'$')};
});
const fragments=Object.keys(catalog).filter(key=>/[\u3400-\u9fff]/.test(key)&&key.length>=4&&!/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length);
const canonical=new Map();
for(const [key,row] of Object.entries(catalog))for(const value of Object.values(row))if(value.trim()&&!canonical.has(value))canonical.set(value,key);
export function translate(message,locale='zh',values={}){
 if(typeof message!=='string')return message;
 locale=normalizeLocale(locale);
 if(!Object.hasOwn(catalog,message)&&canonical.has(message))message=canonical.get(message);
 const row=catalog[message];
 if(row)return interpolate(locale==='zh'?message:(row[locale]??message),values);
 if(locale!=='zh'){
  for(const {key,names,re} of patterns){const match=re.exec(message);if(match){const args={};names.forEach((name,i)=>args[name]=match[i+1]);return interpolate(catalog[key][locale]??key,args);}}
  // Service errors and dictionary attribution may concatenate localized fragments and technical details.
  let localized=message;
  for(const key of fragments)if(localized.includes(key))localized=localized.split(key).join(catalog[key][locale]??key);
  return interpolate(localized,values);
 }
 return interpolate(message,values);
}
export {catalog};
