import { t, localeTag } from "./i18n";
import React from 'react';
import { Download, FolderOpen, Check, Headphones, ExternalLink, LoaderCircle } from 'lucide-react';
import { api, languages } from './bridge';
export default function Models({
  models,
  setModels,
  ocr,
  run,
  downloading,
  setDownloading,
  progress,
  settings,
  onAI
}) {
  async function install(code, upgrade = false) {
    setDownloading(code);
    try {
      const result = await api.call(code === 'offline' ? 'import-models' : code === 'speech' ? 'install-speech' : 'install-language', {
        code,
        upgrade
      });
      if (result) setModels(result);
    } finally {
      setDownloading(null);
    }
  }
  return <><header className="page-heading"><div><h1>{t("语言与模型")}</h1><p>{t("AI 与本地翻译，按需切换。")}</p></div></header><div className="storage-row"><FolderOpen size={20} /><div><strong>{t("模型存储位置")}</strong><p title={models.path}>{models.path}</p></div><button onClick={() => run(() => api.call('open-models'))}>{t("打开目录")}</button><button disabled={!!downloading} onClick={() => run(async () => {
        const m = await api.call('choose-models');
        if (m) setModels(m);
      })}>{t("更改")}</button></div><p className="subtle">{t("更改目录不会移动或删除原模型。可选择已有模型目录，或在新位置重新下载。")}</p>{downloading && <div className="download-status" role="status"><LoaderCircle className="spin" size={18} /><span>{t(progress?.message) || t("正在准备下载…")}</span>{progress?.percent != null && <progress max="100" value={progress.percent} />}</div>}<div className="notice"><div><strong>{settings.aiEnabled ? t("AI 直接互译 · 已启用") : t("本地直接翻译 · 不使用英语中转")}</strong><p>{settings.aiEnabled ? t("将识别到的原文直接翻译为所选目标语种，支持一句中混合多种语言。AI 翻译无需下载下面的离线包。") : t("本地翻译需要原文 → 目标语种的对应直译包。缺少该方向时会提示启用 AI，不会通过英语二次翻译。")}</p></div><button onClick={onAI}>{settings.aiEnabled ? t("管理 AI 连接") : t("接入 AI")}</button></div><div className="notice"><div><strong>{t("内置语言包与补充安装")}</strong><p>{t("完整离线安装版包含 8 种语言、14 个与英语互译的方向和多语种语音模型。源码版需选择已有模型目录，或准备相应模型后使用。")}</p><p>{t("可选择已有模型目录，或下载所需模型。基础离线包可导入中英模型和语音识别包；补充下载支持断点续传。")}</p></div><button disabled={!!downloading} onClick={() => run(() => install('offline'))}><FolderOpen size={16} />{t("导入离线包")}</button></div><h2 className="model-heading">{t("翻译语言 ")}<span>{t("8 种常用语言 · 可作为原文或目标语种")}</span></h2><div className="model-list">{Object.entries(languages).map(([code, name]) => {
        const outgoing = models.pairs.filter(p => p[0] === code).map(p => languages[p[1]] || p[1]);
        return <div className="model-row" key={code}><span className="language-monogram">{code.toUpperCase()}</span><div><strong>{name}</strong><p>{settings.aiEnabled ? t("AI：直接翻译到所选目标语言，无需英语中转") : outgoing.length ? t("本机直译方向：{0} → {1}", [name, outgoing.join('、')]) : t("本机暂无此语种的直译包，可接入 AI 翻译")}</p></div><span className="subtle">{settings.aiEnabled ? t("AI 已启用") : t("离线模式")}</span></div>;
      })}</div><details className="appearance-disclosure" open={!settings.aiEnabled}><summary>{t("内置翻译包 ")}<span className="subtle">{t("可供本地使用")}</span></summary><p className="subtle">{t("以下包只提供标明的两种语言之间的直接翻译。这 8 种语言的内置包提供与英语的直接语言对；中文与日语等其他组合请用 AI 直译。不会下载后再经英语中转。")}</p><div className="model-list">{Object.entries(languages).filter(([code]) => code !== 'en').map(([code, name]) => {
          const installed = models.pairs.some(p => p[0] === code && p[1] === 'en') && models.pairs.some(p => p[1] === code && p[0] === 'en');
          return <div className="model-row" key={code}><span className="language-monogram">{code.toUpperCase()}</span><div><strong>{name} ↔ English</strong><p>{t("双向离线直译包 · 仅用于这一语言对")}</p></div><button className={installed ? 'installed' : ''} disabled={!!downloading} onClick={() => run(() => install(code, installed))}>{installed ? <Check size={16} /> : <Download size={16} />} {installed ? t("已安装 · 检查内置版本") : downloading === code ? t("下载中…") : t("下载直译包")}</button></div>;
        })}</div></details><h2 className="model-heading">{t("本地词典")}</h2><div className="notice"><div><strong>{t("双解词典与词性词库 · 已内置")}</strong><p>{t("约 77 万词条，含词性解释与词形变化。英语词典检索与 AI 正文翻译独立；其他语言词头可能借助英语检索词典，并标明来源。")}</p></div><Check size={20} /></div><h2 className="model-heading">{t("语音识别")}</h2><div className="model-row speech-model"><span className="language-monogram"><Headphones size={22} /></span><div><strong>{t("Whisper Base · 多语种语音包")}</strong><p>{t("约 148 MB · 8 种语言共用")}</p></div><button className={models.speech ? 'installed' : ''} disabled={!!downloading || models.speech} onClick={() => run(() => install('speech'))}>{models.speech ? <Check size={16} /> : <Download size={16} />} {models.speech ? t("已安装") : t("下载语音包")}</button></div><h2 className="model-heading">{t("屏幕文字识别")}</h2><div className="notice"><div><strong>{t("中英屏幕识别已内置")}</strong><p>{t("无需额外安装中英 OCR。其他语种可在 Windows 语言设置中添加。")}</p><p>{ocr.length ? t("本机已安装：") + ocr.map(l => l.name).join('、') : t("在 Windows 语言选项中安装对应语言的文字识别功能。")}</p></div><button onClick={() => run(() => api.call('windows-languages'))}>{t("语言设置")}<ExternalLink size={15} /></button></div><p className="subtle">{t("语音识别包用于听写，翻译包用于转换语言，不包含语音朗读。源码版需自行准备模型。下载失败会切换备用源，可重试续传；已完成的文件会保留。网络可达性受运营商和站点影响，也可导入离线包。")}</p></>;
}
