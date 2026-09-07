import { t, localeTag } from "./i18n";
import InterfaceLanguage from './InterfaceLanguage';
import React from 'react';
import { Sun, Moon, Eye, EyeOff, X } from 'lucide-react';
import { Field, Toggle } from './components';
import { api } from './bridge';
import MultiLanguage from './MultiLanguage';
import Palette from './Palette';
const samples = {
  zh: '保持好奇，听见世界。',
  en: 'Stay curious. Keep listening.',
  ja: '好奇心を持ち、耳を傾けよう。',
  ko: '호기심을 갖고 계속 들어보세요.',
  fr: 'Restez curieux. Continuez à écouter.',
  de: 'Bleib neugierig. Hör weiter zu.',
  es: 'Mantén la curiosidad. Sigue escuchando.',
  ru: 'Сохраняйте любопытство. Продолжайте слушать.'
};
export function SubtitleSettings({
  settings: s,
  update,
  run
}) {
  const previews = s.multiTarget ? s.subtitleTargets : [{
    code: s.target,
    fontSize: s.fontSize
  }];
  return <div className="subtitle-settings">
  <div className="subtitle-preview-stage"><div className="subtitle-preview" style={{
        backgroundColor: s.backgroundColor + Math.round((s.backgroundEnabled ? s.backgroundOpacity : 0) / 100 * 255).toString(16).padStart(2, '0'),
        textShadow: s.textShadow ? "0 1px 3px #0007" : "none",
        color: s.textColor,
        fontFamily: s.fontFamily,
        backdropFilter: s.backgroundEnabled && s.backgroundBlur ? `blur(${s.allowSubtitleCapture !== false ? 20 : s.blurLevel * 2}px)` : 'none'
      }}>
   {s.bilingual && <small style={{
          fontSize: Math.min(s.fontSize * .64, 23)
        }}>Stay curious. Keep listening.</small>}
   {previews.map(row => <div className="preview-language" key={row.code}><span style={{
            fontSize: Math.min(row.fontSize, 40),
            color: row.textColor || s.textColor
          }}>{samples[row.code]}</span></div>)}
  </div></div><p className="subtle transparency-caption">{t("棋盘格表示透明区域，桌面字幕会透出后方窗口。")}</p>
  <Field label={s.multiTarget ? t("原文字号 / 默认字号") : t("字号")}><input aria-label={t("字幕字号")} type="range" min="16" max="64" value={s.fontSize} onChange={e => update({
        fontSize: +e.target.value
      })} /><output>{s.fontSize}px</output></Field>
  <Field label={t("字幕宽度")}><input aria-label={t("字幕宽度")} type="range" min="1" max="20" step="1" value={s.widthLevel} onChange={e => update({
        widthLevel: +e.target.value
      })} /><output>{s.widthLevel} / 20</output></Field>
  <Field label={t("字体")}><select aria-label={t("字幕字体")} value={s.fontFamily} onChange={e => update({
        fontFamily: e.target.value
      })}><option value="Microsoft YaHei UI">{t("微软雅黑")}</option><option value="Segoe UI">Segoe UI</option><option value="SimHei">{t("黑体")}</option><option value="SimSun">{t("宋体")}</option></select></Field>
  <Field label={t("文字颜色")} description={t("开关控制文字投影")}><Palette label={t("字幕文字颜色")} value={s.textColor} onChange={textColor => update({
        textColor
      })} /><Toggle label={t("字幕文字投影")} checked={s.textShadow} onChange={textShadow => update({
        textShadow
      })} /></Field>
  <Field label={t("背景颜色")}><Toggle label={t("显示字幕背景")} checked={s.backgroundEnabled} onChange={backgroundEnabled => update({
        backgroundEnabled
      })} /><Palette disabled={!s.backgroundEnabled} label={t("字幕背景颜色")} value={s.backgroundColor} onChange={backgroundColor => update({
        backgroundColor
      })} /></Field>
  <Field label={t("背景不透明度")}><input disabled={!s.backgroundEnabled} aria-label={t("背景不透明度")} type="range" min="1" max="10" step="1" value={s.opacityLevel} onChange={e => update({
        opacityLevel: +e.target.value
      })} /><output>{s.opacityLevel} / 10</output></Field>
  <Field label={t("背景模糊")} description={t("实时模糊后方画面，背景颜色和不透明度保持原设置。")}><Toggle label={t("背景模糊")} disabled={!s.backgroundEnabled} checked={s.backgroundBlur} onChange={backgroundBlur => update({
        backgroundBlur
      })} /></Field>
  <Field label={t("允许截图与录屏")} description={t("默认开启，可用外部软件捕获字幕；磨砂采用 Windows 系统模糊。关闭后可使用十档精细模糊，但字幕不会出现在截图中。")}><Toggle label={t("允许截图与录屏")} checked={s.allowSubtitleCapture !== false} onChange={allowSubtitleCapture => update({
        allowSubtitleCapture
      })} /></Field>
  {s.backgroundBlur && (s.allowSubtitleCapture !== false ? <Field label={t("模糊程度")} description={t("由 Windows 调整系统磨砂强度；背景颜色与不透明度仍可独立设置。")}><output>{t("系统磨砂")}</output></Field> : <Field label={t("模糊程度")} description={t("10 档模糊半径；完全不透明时，后方画面被背景颜色遮住。")}><input disabled={!s.backgroundEnabled} aria-label={t("背景模糊程度")} type="range" min="1" max="10" step="1" value={s.blurLevel} onChange={e => update({
        blurLevel: +e.target.value
      })} /><output>{s.blurLevel} / 10</output></Field>)}
  <div className="button-row"><button onClick={() => run(() => api.call('overlay', {
        action: 'preview'
      }))}><Eye size={16} />{t("桌面预览")}</button><button onClick={() => run(() => api.call('overlay', {
        action: 'hide'
      }))}><EyeOff size={16} />{t("隐藏")}</button><button onClick={() => run(() => api.call('overlay', {
        action: 'close'
      }))}><X size={16} />{t("关闭")}</button></div>
  <p className="subtle">{t("移入字幕上沿显示拖拽与操作区 · 字幕内可切换原文 / 仅译文 · Ctrl + Shift + L 隐藏")}</p>
 </div>;
}
export default function Settings({
  interfaceReady = true,
  settings: s,
  update,
  run,
  onModels
}) {
  return <><header className="page-heading"><div><h1>{t("设置")}</h1><p>{t("让每一次理解，都合乎你的习惯。")}</p></div></header>
 <section className="settings-section"><h2>{t("界面语言")}</h2><Field label={t("界面语言")} description={t("只更改界面文字，不改变识别语言与翻译方向。切换后立即生效，并自动保存。")}><InterfaceLanguage disabled={!interfaceReady} value={s.uiLanguage} onChange={uiLanguage=>update({uiLanguage})}/></Field></section><section className="settings-section"><h2>{t("外观")}</h2><div className="theme-options"><button className={s.theme === 'light' ? 'selected' : ''} onClick={() => update({
          theme: 'light'
        })}><Sun size={22} />{t("亮色")}<span>{t("清晰，轻盈")}</span></button><button className={s.theme === 'dark' ? 'selected' : ''} onClick={() => update({
          theme: 'dark'
        })}><Moon size={22} />{t("暗色")}<span>{t("专注，柔和")}</span></button></div></section>
 <section className="settings-section"><h2>{t("窗口行为")}</h2><Field label={t("点击关闭按钮时")} description={t("最小化会继续当前翻译；退出软件会停止识别与监听。")}><select aria-label={t("关闭窗口时")} value={s.closeAction || 'ask'} onChange={e => update({
          closeAction: e.target.value
        })}><option value="ask">{t("每次询问")}</option><option value="minimize">{t("最小化")}</option><option value="quit">{t("退出软件")}</option></select></Field></section>
 <MultiLanguage settings={s} update={update} onModels={onModels} />
 <section className="settings-section"><h2>{t("字幕显示")}</h2><Field label={t("显示原文")}><Toggle checked={s.bilingual} label={t("同时显示原文")} onChange={bilingual => update({
          bilingual
        })} /></Field><Field label={t("每种语言显示行数")} description={t("一行是一组原文与译文。最多保留最近 3 组；文字过长时自动换行撑开背景。")}><select aria-label={t("字幕行数")} value={s.lines} onChange={e => update({
          lines: +e.target.value
        })}>{[1, 2, 3].map(n => <option key={n} value={n}>{t("{0} 行", [n])}</option>)}</select></Field></section>
 <section className="settings-section"><h2>{t("桌面字幕")}</h2><SubtitleSettings settings={s} update={update} run={run} /></section>
 <section className="settings-section"><h2>{t("处理与隐私")}</h2><Field label={t("保存本地翻译历史")} description={t("最多保留 30 条。关闭时清除已有历史；音频文件不会复制到应用。")}><Toggle label={t("保存翻译历史")} checked={s.history} onChange={history => update({
          history
        })} /></Field><p className="subtle">{t("识别在本地运行；本地模式离线翻译，AI 模式将待译文字及开启的短上下文发送至所选服务商。模型下载连接官方站点。自动划词开启后，会在需要时复制选区。关闭应用将停止所有监听。")}</p></section>
 </>;
}
