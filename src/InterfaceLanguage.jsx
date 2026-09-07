import React from 'react';
import {Languages} from 'lucide-react';
import {t,interfaceLanguages} from './i18n';

export default function InterfaceLanguage({value,onChange,compact=false,disabled=false}) {
 return <label className={compact?'interface-language compact':'interface-language'}>
  <Languages size={18} aria-hidden="true"/>
  <select disabled={disabled} aria-label={t('界面语言')} title={t('界面语言')} value={value||'zh'} onChange={e=>onChange(e.target.value)}>
   {interfaceLanguages.map(({code,name})=><option value={code} key={code} lang={code}>{name}</option>)}
  </select>
 </label>;
}
