import { t, localeTag } from "./i18n";
import React, { useState } from 'react';
import { ArrowLeftRight, Monitor, Copy, Check, ChevronRight, Trash2, CaseSensitive } from 'lucide-react';
import { languages, api } from './bridge';
import WordWorkspace from './Words';
import { missingTranslationTargets } from './model-readiness.mjs';
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false
}) {
  return <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={'switch ' + (checked ? 'on' : '')} onClick={() => onChange(!checked)}><span /></button>;
}
export function LanguageBar({
  settings,
  update,
  models,
  editorControls = false,
  onSwap,
  swapDisabled = false,
  swapTitle
}) {
  const [sizes, setSizes] = useState(false);
  const enabled = Object.keys(languages).filter(code => settings.aiEnabled || ['en', 'zh'].includes(code) || models.pairs.some(p => p.includes(code)));
  return <div className="language-bar"><select aria-label={t("原文语言")} value={settings.source} onChange={e => update({
      source: e.target.value
    })}><option value="auto">{settings.aiEnabled ? t("自动 · 含混合语种") : t("自动 · 中英日韩俄")}</option>{enabled.map(code => <option key={code} value={code}>{languages[code]}</option>)}</select><button disabled={onSwap ? swapDisabled : settings.multiTarget} className="icon-button" title={swapTitle || (onSwap ? swapDisabled ? t("等待翻译完成，或先选择原文语言") : settings.multiTarget ? t("将第一种译文与原文交换") : t("交换原文与译文语言及内容") : settings.multiTarget ? t("多语种的目标语言请在设置中调整") : t("交换语言"))} aria-label={t("交换语言")} onClick={onSwap || (() => update({
      source: settings.target,
      target: settings.source === 'auto' ? 'en' : settings.source
    }))}><ArrowLeftRight size={18} /></button>{settings.multiTarget ? <span className="target-summary">{settings.subtitleTargets.map(targetRow => languages[targetRow.code]).join(' · ')}</span> : <select aria-label={t("目标语言")} value={settings.target} onChange={e => update({
      target: e.target.value
    })}>{enabled.map(code => <option key={code} value={code}>{languages[code]}</option>)}</select>}{editorControls && <div className="editor-size-control"><button className="editor-size-trigger" aria-label={t("原文和译文字号")} aria-expanded={sizes} onClick={() => setSizes(!sizes)}><CaseSensitive size={19} /><span>{t("字号")}</span></button>{sizes && <div className="editor-size-panel" role="group" aria-label={t("阅读字号")}>{[[t("原文"), 'editorSourceSize'], [t("译文"), 'editorTargetSize']].map(([label, key]) => <div key={key}><span>{label}</span>{[['small', t("小")], ['medium', t("中")], ['large', t("大")]].map(([value, name]) => <button key={value} aria-label={label + name + t("号")} aria-pressed={settings[key] === value} onClick={() => update({
            [key]: value
          })}>{name}</button>)}</div>)}</div>}</div>}<span className="local-label"><Monitor size={15} />{settings.aiEnabled ? t("AI 翻译") : t("本地翻译")}</span></div>;
}
export function Bilingual(props) {
  return <WordWorkspace {...props} />;
}
export function ModelNotice({
  models,
  onOpen,
  audio = false,
  aiEnabled = false,
  settings = {},
  detectedSource
}) {
  const missing = missingTranslationTargets({
    ...settings,
    aiEnabled
  }, models, detectedSource);
  const speechMissing = audio && !models.speech;
  if (!speechMissing && !missing.length) return null;
  return <div className="notice"><div><strong>{speechMissing ? t("当前目录缺少语音识别模型") : t("当前语言方向未包含本地直译包")}</strong><p>{speechMissing ? t("听译需先把声音识别为文字，翻译包不能替代语音识别包。请选择含 Whisper 的模型目录、下载语音包，或导入基础离线包。") : t("缺少到 {0} 的直译方向。内置包支持英语与其他 7 种语言互译；其他组合可开启 AI 直译。", [missing.map(targetRow => languages[targetRow] || targetRow).join('、')])}</p>{speechMissing && <p>{t("实际读取目录：{0}", [models.path])}</p>}</div><button onClick={onOpen}>{t("查看模型")}<ChevronRight size={15} /></button></div>;
}
export function History({
  items,
  clear
}) {
  return <section className="history"><div className="section-label"><span>{t("最近翻译")}</span><button className="text-button" disabled={!items.length} onClick={clear}>{t("清空历史")}</button></div>{items.length ? items.slice(0, 5).map((item, i) => <div className="history-row" key={item.id || i}><span>{item.text}</span><span>{item.translation}</span><time>{new Date(item.time || Date.now()).toLocaleTimeString(localeTag())}</time></div>) : <p className="history-empty">{t("暂时没有记录。可在设置中开启本地翻译历史。")}</p>}</section>;
}
export function Field({
  label,
  children,
  description
}) {
  return <div className="field"><div><span>{label}</span>{description && <p>{description}</p>}</div><div className="field-controls">{children}</div></div>;
}
