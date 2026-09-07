import {setLocale,t,localeTag} from './i18n';
export const defaults={uiLanguage:'zh',theme:'light',closeAction:'ask',source:'en',target:'zh',fontSize:28,fontFamily:'Microsoft YaHei UI',textColor:'#ffffff',textShadow:true,editorSourceSize:'medium',editorTargetSize:'medium',backgroundColor:'#16171d',backgroundOpacity:78,opacityLevel:8,favoriteBackground:'#2457c5',favoriteColor:'#ffffff',libraryDates:false,allowSubtitleCapture:true,backgroundBlur:false,backgroundEnabled:true,blurTone:'dark',blurLevel:4,blurAmount:16,widthLevel:4,lines:2,bilingual:true,overlayWidth:760,chunkSeconds:3,history:false,multiTarget:false,subtitleTargets:[{code:'zh',fontSize:28,textColor:'#ffffff'}]};
const languageCodes=['en','zh','ja','ko','fr','de','es','ru'];
export const languages=Object.fromEntries(languageCodes.map(code=>[code,code]));
for(const code of languageCodes)Object.defineProperty(languages,code,{enumerable:true,get:()=>new Intl.DisplayNames([localeTag()],{type:'language'}).of(code)});
export const desktop=!!window.lingua;
const rawApi=window.lingua||{
 async call(command,args={}){
  if(command==='bootstrap')return {settings:{...defaults,...JSON.parse(localStorage.getItem('settings')||'{}')},models:{path:'在 Windows 应用中选择存储位置',pairs:[],speech:false},history:[],ocr:[],desktop:false};
  if(command==='settings'){localStorage.setItem('settings',JSON.stringify(args));return args;}
  if(command==='window'||command==='clear-history')return true;
  if(command==='copy'){await navigator.clipboard.writeText(args.text);return true;}
  throw new Error('此功能需要 Windows 桌面应用。浏览器仅用于界面预览，请启动 Lishon.exe。');
 },on(){return ()=>{};}
};

export const api={async call(command,args){try{const value=await rawApi.call(command,args);if(command==='bootstrap')setLocale(value.settings.uiLanguage);if(command==='settings')setLocale(value.uiLanguage);return value;}catch(error){throw new Error(t(error.message));}},on(name,callback){return rawApi.on(name,value=>{if(name==='settings')setLocale(value.uiLanguage);callback(value);});}};
