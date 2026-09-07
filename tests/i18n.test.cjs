const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalog,translate,normalizeLocale,interfaceLanguages}=require('../shared/i18n.mjs');
const {cleanSettings}=require('../electron/core.cjs');
const locales=['en','ja','ko','fr','ru'];
test('every UI message has five translations and preserves all interpolation placeholders',()=>{
 assert.ok(Object.keys(catalog).length>500);
 const placeholders=s=>[...s.matchAll(/\{\d+\}/g)].map(x=>x[0]).sort();
 for(const [key,row] of Object.entries(catalog))for(const locale of locales){assert.equal(typeof row[locale],'string',locale+': '+key);assert.ok(row[locale].length,locale+': '+key);assert.deepEqual(placeholders(row[locale]),placeholders(key),locale+': '+key);}
});
test('UI language is an independent persisted setting with an explicit six-language allowlist',()=>{
 assert.equal(interfaceLanguages.length,6);
 for(const uiLanguage of ['zh',...locales]){const s=cleanSettings({uiLanguage,source:'ja',target:'fr',subtitleTargets:[{code:'ru',fontSize:36}]});assert.equal(s.uiLanguage,uiLanguage);assert.equal(s.source,'ja');assert.equal(s.target,'fr');assert.equal(s.subtitleTargets[0].code,'ru');}
 for(const bad of ['de','constructor','toString','__proto__',null,{}]){assert.equal(normalizeLocale(bad),'zh');assert.equal(cleanSettings({uiLanguage:bad}).uiLanguage,'zh');}
});
test('runtime errors are localized without changing embedded paths and numbers',()=>{
 assert.equal(translate('连接成功 · 2.50 秒','fr'),'Connecté · 2.50 s');
 assert.match(translate('离线包缺失或校验失败：C:\\models\\speech.bin','en'),/C:\\models\\speech\.bin$/);
 assert.equal(translate('API Key 无效或已过期','ru'),'Ключ API недействителен или истёк');
 assert.equal(translate('Invalid or expired API key','zh'),'API Key 无效或已过期');
 assert.equal(translate('My original paragraph is not a UI label.','ja'),'My original paragraph is not a UI label.');
});
test('literal renderer translation calls are present in the catalog',()=>{
 const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
 for(const file of fs.readdirSync(path.join(__dirname,'../src')).filter(x=>/\.(jsx|js)$/.test(x))){
  const ast=parser.parse(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{sourceType:'module',plugins:['jsx']});
  traverse(ast,{CallExpression(p){if(p.node.callee.name==='t'&&p.node.arguments[0]?.type==='StringLiteral')assert.ok(Object.hasOwn(catalog,p.node.arguments[0].value),file+': '+p.node.arguments[0].value);}});
 }
});
