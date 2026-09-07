import React,{useSyncExternalStore} from 'react';
import {translate,normalizeLocale,localeTags,interfaceLanguages} from '../shared/i18n.mjs';
export {interfaceLanguages};
let locale='zh';
try {locale=normalizeLocale(localStorage.getItem('lishon-interface-language'));} catch {}
const listeners=new Set();
export function currentLocale(){return locale;}
export function localeTag(){return localeTags[locale];}
export function t(message,values){
 if(values?.some?.(value=>React.isValidElement(value))) {
  const pattern=translate(message,locale);
  return pattern.split(/(\{\d+\})/).map((part,index)=>{
   const match=/^\{(\d+)\}$/.exec(part);const value=match?values[+match[1]]:part;
   return React.isValidElement(value)?React.cloneElement(value,{key:index}):value;
  });
 }
 return translate(message,locale,values);
}
export function setLocale(value){
 const next=normalizeLocale(value);
 document.documentElement.lang=localeTags[next];
 document.documentElement.dataset.locale=next;
 try {localStorage.setItem('lishon-interface-language',next);} catch {}
 if(next===locale)return;
 locale=next;for(const listener of listeners)listener();
}
export function LocaleRoot({children}) {
 useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},currentLocale);
 return React.cloneElement(children,{interfaceLocale:locale});
}
setLocale(locale);
