export function missingTranslationTargets(settings,models,detectedSource){
 if(settings.aiEnabled)return [];
 const source=settings.source==='auto'?detectedSource:settings.source;
 const targets=settings.multiTarget?settings.subtitleTargets.map(t=>t.code):[settings.target||'zh'];
 return targets.filter(target=>source?source!==target&&!models.pairs.some(p=>p[0]===source&&p[1]===target):!models.pairs.some(p=>p[1]===target));
}
