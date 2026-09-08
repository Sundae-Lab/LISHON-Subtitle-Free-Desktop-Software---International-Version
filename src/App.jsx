import { t, localeTag } from "./i18n";
import InterfaceLanguage from './InterfaceLanguage';
import { setLocale } from './i18n';
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, BookOpen, TextSelect, ScanLine, Headphones, Globe2, Settings as SettingsIcon, AudioLines, Monitor, Minus, Square, X, Sun, Moon, Info, ShieldCheck } from 'lucide-react';
import { api, defaults, desktop } from './bridge';
import { LanguageBar, Bilingual, Toggle, ModelNotice } from './components';
import Capture from './Capture';
import Models from './Models';
import AIConnection from './AIConnection';
import Settings from './Settings';
import Library from './Library';
import CloseDialog from './CloseDialog';
import { DraftController } from './draft-controller.mjs';
import { swappedLanguageDraft } from './language-swap.mjs';
export default function App() {
  const [page, setPage] = useState('text'),
    [settings, setSettings] = useState(defaults),
    [models, setModels] = useState({
      path: t("正在读取…"),
      pairs: [],
      speech: false
    }),
    [ocr, setOcr] = useState([]),
    [history, setHistory] = useState([]),
    [text, setSourceText] = useState(''),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [selection, setSelection] = useState(false),
    [screenState, setScreenState] = useState({
      active: false,
      region: null
    }),
    [error, setError] = useState(''),
    [downloading, setDownloading] = useState(null),
    [progress, setProgress] = useState(null),
    [ready, setReady] = useState(false);
  const [aiSwitching, setAiSwitching] = useState(false);
  const aiToggleLock = useRef(false);
  const swapLock = useRef(false);
  const [swapping, setSwapping] = useState(false);
  const draft = useRef(null);
  if (!draft.current) draft.current = new DraftController({
    translate: text => api.call('translate', {
      text
    }),
    onDraft: setSourceText,
    onResult: setResult,
    onBusy: setBusy,
    onError: e => setError(e.message || String(e))
  });
  const setText = value => {
    setError('');
    draft.current.edit(value);
    api.call('translate-cancel').catch(() => {});
  };
  useEffect(() => () => draft.current.dispose(), []);
  const [mainIndex, setMainIndex] = useState(0),
    [closeOpen, setCloseOpen] = useState(false);
  const mainRef = useRef(null);
  useEffect(() => {
    mainRef.current?.scrollTo({
      top: 0
    });
  }, [page]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  async function run(fn) {
    try {
      setError('');
      return await fn();
    } catch (e) {
      setError(e.message || String(e));
    }
  }
  async function update(part) {
    if (part.uiLanguage) setLocale(part.uiLanguage);
    const next = {
      ...settingsRef.current,
      ...part
    };
    if (part.textColor) next.subtitleTargets = next.subtitleTargets.map(targetRow => ({
      ...targetRow,
      textColor: part.textColor
    }));
    settingsRef.current = next;
    setSettings(next);
    if (part.history === false) setHistory([]);
    await run(() => api.call('settings', next));
  }
  useEffect(() => {
    run(async () => {
      const data = await api.call('bootstrap');
      settingsRef.current = data.settings;
      setSettings(data.settings);
      setModels(data.models);
      setHistory(data.history);
      setOcr(data.ocr);
      setScreenState(data.screenState || {
        active: false,
        region: data.region
      });
      setReady(true);
    });
    const off = [api.on('close-request', () => setCloseOpen(true)), api.on('result', item => {
      if (settingsRef.current.history) setHistory(old => [item, ...old].slice(0, 30));
    }), api.on('selection-text', item => {
      setError('');
      api.call('translate-cancel').catch(() => {});
      draft.current.edit(item.text, {
        immediate: true
      });
    }), api.on('selection-state', setSelection), api.on('settings', value => {
      settingsRef.current = value;
      setSettings(value);
    }), api.on('error', setError), api.on('download', setProgress), api.on('screen-state', setScreenState)];
    return () => off.forEach(fn => fn());
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const repaint = setTimeout(() => api.call('window', {
      action: 'refresh-theme'
    }).catch(() => {}), 380);
    return () => clearTimeout(repaint);
  }, [settings.theme]);
  useEffect(() => {
    if (ready && !swapLock.current && draft.current.value) draft.current.refresh();
  }, [settings.aiRevision, settings.source, settings.target, settings.multiTarget, JSON.stringify(settings.subtitleTargets?.map(x => x.code))]);
  async function swapLanguages() {
    if (swapLock.current) return;
    const next = swappedLanguageDraft(settingsRef.current, draft.current.value, result);
    if (!next) {
      setError(t("请先识别原文，或手动选择原文语言，再交换语言。"));
      return;
    }
    swapLock.current = true;
    setSwapping(true);
    setError('');
    const previous = draft.current.value;
    let clearedRevision;
    try {
      // Invalidate the previous request before changing the route; don't submit under old settings.
      draft.current.edit('');
      clearedRevision = draft.current.revision;
      await api.call('translate-cancel');
      const saved = await api.call('settings', {
        ...settingsRef.current,
        ...next.settings
      });
      settingsRef.current = saved;
      setSettings(saved);
      draft.current.edit(draft.current.revision === clearedRevision ? next.text : draft.current.value);
    } catch (e) {
      if (draft.current.revision === clearedRevision) draft.current.edit(previous);
      setError(e.message || String(e));
    } finally {
      swapLock.current = false;
      setSwapping(false);
    }
  }
  async function toggleAI() {
    if (aiToggleLock.current) return;
    aiToggleLock.current = true;
    setAiSwitching(true);
    try {
      await run(async () => {
        const status = await api.call('ai-status');
        if (!status.enabled && !status.hasKey) {
          setPage('ai');
          setError(t("请先填写并保存 API 连接，再开启 AI 翻译。"));
          return;
        }
        await api.call('ai-enable', {
          enabled: !status.enabled
        });
      });
    } finally {
      aiToggleLock.current = false;
      setAiSwitching(false);
    }
  }
  function translate() {
    draft.current.submit();
  }
  const mainNav = [['text', TextSelect, t("划词翻译")], ['screen', ScanLine, t("屏幕字幕")], ['audio', Headphones, t("实时听译")], ['library', BookOpen, t("我的语库")]];
  return <div className="app-shell" style={{
    '--favorite-bg': settings.favoriteBackground,
    '--favorite-color': settings.favoriteColor
  }}><div className="titlebar"><div className="window-buttons"><button role="switch" aria-label={t("AI 翻译")} aria-checked={!!settings.aiEnabled} disabled={!ready || aiSwitching} className="header-ai-toggle" title={settings.aiEnabled ? t("关闭 AI 翻译，保留 API 配置并使用本地语言包") : t("开启 AI 翻译，使用已保存的 API 连接")} onClick={e=>{const mode=e.target.closest("[data-mode]")?.dataset.mode;if(!mode||(mode==="ai")!==!!settings.aiEnabled)toggleAI();}}><span className="mode-local" data-mode="local"><Monitor size={15}/><span>{t("本地翻译")}</span></span><i className="header-ai-track" aria-hidden="true" /><span className="mode-ai" data-mode="ai"><Sparkles size={15}/><span>AI</span></span></button><InterfaceLanguage compact disabled={!ready} value={settings.uiLanguage} onChange={uiLanguage => update({
          uiLanguage
        })} /><button aria-label={t("切换亮暗主题")} title={t("切换亮暗主题")} onClick={() => update({
          theme: settings.theme === 'light' ? 'dark' : 'light'
        })}>{settings.theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><button aria-label={t("最小化")} onClick={() => api.call('window', {
          action: 'minimize'
        })}><Minus size={16} /></button><button aria-label={t("最大化")} onClick={() => api.call('window', {
          action: 'maximize'
        })}><Square size={13} /></button><button aria-label={t("关闭应用")} className="window-close" onClick={() => api.call('window', {
          action: 'close'
        })}><X size={17} /></button></div></div><aside className="sidebar"><nav className="main-nav" aria-label={t("翻译模式")} style={{
        '--nav-index': mainIndex
      }}><span className={'nav-slider' + (mainNav.some(([id]) => id === page) ? '' : ' inactive')} aria-hidden="true" />{mainNav.map(([id, Icon, label], index) => <button key={id + settings.theme} className={page === id ? 'nav-item selected' : 'nav-item'} aria-current={page === id ? 'page' : undefined} title={label} onClick={() => {
          setMainIndex(index);
          setPage(id);
        }}><Icon size={22} /><span>{label}</span>{id === 'screen' && screenState.active && <i className="live-dot" />}</button>)}</nav><nav className="utility-nav" aria-label={t("应用选项")}>{[['ai', Sparkles, t("接入 AI")], ['models', Globe2, t("语言与模型")], ['settings', SettingsIcon, t("设置")]].map(([id, Icon, label]) => <button key={id} className={page === id ? 'nav-item selected' : 'nav-item'} aria-current={page === id ? 'page' : undefined} title={label} onClick={() => setPage(id)}><Icon size={18} /><span>{label}</span></button>)}</nav></aside><div className="main-column"><main ref={mainRef}>{!desktop && <div className="preview-banner">{t("界面预览 · 桌面采集与离线翻译请在 Windows 应用中使用")}</div>}{error && <div className="error-banner" role="alert"><Info size={18} /><span>{t(error)}</span><button className="icon-button" aria-label={t("关闭提示")} onClick={() => setError('')}><X size={16} /></button></div>}<div hidden={page !== 'text'}><header className="page-heading"><div><h1>{t("划词翻译")}</h1><p>{t("选中文字，即时呈现双语。")}</p></div><div className="inline"><span>{t("自动划词")}</span><Toggle label={t("自动划词")} checked={selection} onChange={enabled => run(async () => setSelection(await api.call('selection', {
                enabled
              })))} /></div></header><ModelNotice settings={settings} aiEnabled={settings.aiEnabled} models={models} onOpen={() => setPage('models')} /><section className="translation-workspace"><LanguageBar editorControls settings={settings} update={update} models={models} onSwap={() => run(swapLanguages)} swapDisabled={swapping || busy || !swappedLanguageDraft(settings, text, result)} /><Bilingual text={text} setText={setText} result={result} settings={settings} busy={busy} onTranslate={() => run(translate)} /></section><div className="hint"><Info size={17} /><span>{selection ? t("已开启：在其他应用中拖动选中文字，将自动显示双语译文。") : t("开启自动划词后，在其他应用中选中文字即可翻译。")}</span></div><details className="selection-help"><summary>{t("部分应用无法读取选中文字？")}</summary><p>{t("在鼠标框选完成后自动复制一次；应用不支持复制时再尝试辅助功能选区。仅处理当前前台窗口，不连续读取剪贴板。图片、禁止复制及更高权限窗口可能无法取词，可改用屏幕字幕。")}</p></details></div><div hidden={page !== 'screen'}><Capture mode="screen" settings={settings} update={update} models={models} onModels={() => setPage('models')} run={run} screenState={screenState} setScreenState={setScreenState} onResult={() => {}} /></div><div hidden={page !== 'audio'}><Capture mode="audio" settings={settings} update={update} models={models} onModels={() => setPage('models')} run={run} screenState={screenState} setScreenState={setScreenState} onResult={() => {}} /></div>{page === 'library' && <Library settings={settings} update={update} />}{page === 'ai' && <AIConnection />}{page === 'models' && <Models settings={settings} onAI={() => setPage('ai')} models={models} setModels={setModels} ocr={ocr} run={run} downloading={downloading} setDownloading={setDownloading} progress={progress} />} {page === 'settings' && <Settings interfaceReady={ready} settings={settings} update={update} run={run} models={models} onModels={() => setPage('models')} />}</main><footer className="statusbar"><span className="studio-credit">MAIS·AI Studio</span><span><i className="dot" />{settings.aiEnabled ? t("AI 翻译 · 原文发送至所选服务商") : t("所有翻译在此设备上处理")}</span><span>{result?.ms != null ? `${(result.ms / 1000).toFixed(2)}s · ${result.engine === 'ai' ? t("AI 翻译") : t("本地翻译")}` : 'Lishon 0.7.2'}</span></footer></div>{closeOpen && <CloseDialog onDismiss={() => setCloseOpen(false)} />}</div>;
}
