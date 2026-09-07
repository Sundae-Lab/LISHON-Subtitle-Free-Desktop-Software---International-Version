const supported=new Set(['en','zh','ja','ko','fr','de','es','ru']);
export function swappedLanguageSettings(settings,detectedSource){
 const source=settings.source==='auto'?detectedSource:settings.source;
 const target=settings.multiTarget?settings.subtitleTargets[0]?.code:settings.target;
 if(!supported.has(source)||!supported.has(target))return null;
 const part={source:target,target:source};
 if(settings.multiTarget){
  const style=settings.subtitleTargets.find(t=>t.code===source)||settings.subtitleTargets[0];
  part.subtitleTargets=[{...style,code:source},...settings.subtitleTargets.slice(1).filter(t=>t.code!==source)];
 }
 return part;
}
// Only a result matching the current draft can become the new source text.
export function swappedLanguageDraft(settings,text,result){
 const current=result?.text===text?result:null;
 const part=swappedLanguageSettings(settings,current?.source);
 if(!part)return null;
 const target=settings.multiTarget?settings.subtitleTargets[0]?.code:settings.target;
 const translated=current?.translations?.find(t=>t.target===target)?.translation
   ??(current?.target===target?current.translation:undefined);
 return {settings:part,text:typeof translated==='string'&&translated.trim()?translated:text};
}
