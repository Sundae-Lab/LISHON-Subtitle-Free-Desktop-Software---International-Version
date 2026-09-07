import { t, localeTag } from "./i18n";
import React from 'react';
import { ArrowUp, ArrowDown, Plus, Trash2, Download } from 'lucide-react';
import { Field, Toggle } from './components';
import Palette from './Palette';
import { languages } from './bridge';
export default function MultiLanguage({
  settings: s,
  update,
  onModels
}) {
  const rows = s.subtitleTargets || [{
    code: s.target,
    fontSize: s.fontSize,
    textColor: s.textColor
  }];
  const change = (index, part) => update({
    subtitleTargets: rows.map((row, i) => i === index ? {
      ...row,
      ...part
    } : row)
  });
  const move = (index, delta) => {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update({
      subtitleTargets: next
    });
  };
  return <section className="settings-section multi-language"><h2>{t("多语种翻译")}</h2>
  <Field label={t("同时翻译为多种语言")} description={t("最多 3 个目标语种，按下面的顺序从上到下显示。")}><Toggle label={t("多语种翻译")} checked={s.multiTarget} onChange={multiTarget => update({
        multiTarget
      })} /></Field>
  {s.multiTarget && <>
   {s.aiEnabled ? <p className="subtle">{t("AI 将一次翻译为以下语种，无需下载本地翻译包；语种越多，响应可能越慢。")}</p> : <div className="notice model-reminder"><div><strong>{t("请下载或更新对应语言包")}</strong><p>{t("新增语种前，前往语言与模型获取最新的双向翻译包。语种越多，处理时间也会增加。")}</p></div><button onClick={onModels}><Download size={15} />{t("前往语言包")}</button></div>}
   <div className="target-list">{rows.map((row, i) => <div className="target-row" key={row.code}>
    <span className="target-index">0{i + 1}</span>
    <select aria-label={t("第 {0} 个目标语种", [i + 1])} value={row.code} onChange={e => change(i, {
            code: e.target.value
          })}>{Object.entries(languages).map(([code, name]) => <option disabled={code !== row.code && rows.some(r => r.code === code)} key={code} value={code}>{name}</option>)}</select>
    <Palette label={t("{0}字幕文字颜色", [languages[row.code]])} value={row.textColor || s.textColor} onChange={textColor => change(i, {
            textColor
          })} /><label className="target-font">{t("字号 ")}<input aria-label={t("{0}字幕字号", [languages[row.code]])} type="range" min="16" max="64" value={row.fontSize} onChange={e => change(i, {
              fontSize: +e.target.value
            })} /><output>{row.fontSize}px</output></label>
    <div className="target-order"><button className="icon-button" disabled={i === 0} aria-label={t("上移{0}", [languages[row.code]])} title={t("上移")} onClick={() => move(i, -1)}><ArrowUp size={16} /></button><button className="icon-button" disabled={i === rows.length - 1} aria-label={t("下移{0}", [languages[row.code]])} title={t("下移")} onClick={() => move(i, 1)}><ArrowDown size={16} /></button><button className="icon-button" disabled={rows.length === 1} aria-label={t("移除{0}", [languages[row.code]])} title={t("移除此语种")} onClick={() => update({
              subtitleTargets: rows.filter((_, n) => n !== i)
            })}><Trash2 size={15} /></button></div>
   </div>)}</div>
   <button className="add-target" disabled={rows.length >= 3} onClick={() => update({
        subtitleTargets: [...rows, {
          code: Object.keys(languages).find(code => !rows.some(r => r.code === code)),
          fontSize: s.fontSize,
          textColor: s.textColor
        }]
      })}><Plus size={16} />{rows.length >= 3 ? t("已达到 3 个语种") : t("添加目标语种")}</button>
  </>}
 </section>;
}
