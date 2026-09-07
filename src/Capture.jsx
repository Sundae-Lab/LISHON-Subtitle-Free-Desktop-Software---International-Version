import { t, localeTag } from "./i18n";
import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, Play, Square, Headphones, Mic, FileAudio, Upload, Download, Eye, ChevronDown, AudioLines, Pause } from 'lucide-react';
import { LanguageBar, ModelNotice } from './components';
import { SubtitleSettings } from './Settings';
import { api, languages } from './bridge';
import { FavoriteText } from './Words';
import { startAudio } from './audio';
import { swappedLanguageSettings } from './language-swap.mjs';
export default function Capture({
  mode,
  settings,
  update,
  models,
  onModels,
  run,
  screenState,
  setScreenState,
  onResult
}) {
  const [favoriteTerms, setFavoriteTerms] = useState([]);
  useEffect(() => {
    api.call('library', {
      action: 'terms'
    }).then(setFavoriteTerms).catch(() => {});
    return api.on('library-index', setFavoriteTerms);
  }, []);
  const [detectedSource, setDetectedSource] = useState(null),
    [swapping, setSwapping] = useState(false);
  const swapLock = useRef(false);
  useEffect(() => {
    setDetectedSource(null);
  }, [settings.source]);
  useEffect(() => api.on('result', item => {
    if (item.origin === mode) setDetectedSource(item.source);
  }), [mode]);
  async function swapLanguages() {
    if (swapLock.current) return;
    const next = swappedLanguageSettings(settings, detectedSource);
    if (!next) return;
    swapLock.current = true;
    setSwapping(true);
    try {
      await update(next);
    } finally {
      swapLock.current = false;
      setSwapping(false);
    }
  }
  const audio = mode === 'audio';
  const [source, setSource] = useState('system'),
    [listening, setListening] = useState(false),
    [starting, setStarting] = useState(false),
    [level, setLevel] = useState(0),
    [elapsed, setElapsed] = useState(null),
    [dropped, setDropped] = useState(0),
    [segments, setSegments] = useState([]),
    [importing, setImporting] = useState(false),
    [file, setFile] = useState(null);
  const stopRef = useRef(null);
  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  };
  useEffect(() => {
    stopRef.current?.reset?.();
  }, [settings.source, settings.target, settings.multiTarget, JSON.stringify(settings.subtitleTargets?.map(targetRow => targetRow.code))]);
  useEffect(() => () => stopRef.current?.(), []);
  useEffect(() => audio ? api.on('segment', event => {
    if (event.job === 'file') setSegments(old => [...old, event.segment]);
  }) : undefined, [audio]);
  async function begin() {
    setStarting(true);
    try {
      await api.call('overlay', {
        action: 'show'
      });
      stopRef.current = await startAudio({
        source,
        seconds: settings.chunkSeconds,
        api,
        onLevel: setLevel,
        onError: e => {
          stop();
          run(() => Promise.reject(e));
        },
        onResult: result => {
          setElapsed(result.ms);
          setDropped(result.dropped);
          for (const item of result.segments) {
            setSegments(old => [...old, item].slice(-100));
            onResult({
              ...item,
              origin: 'audio'
            });
          }
        }
      });
      setListening(true);
    } finally {
      setStarting(false);
    }
  }
  async function importFile() {
    setImporting(true);
    setSegments([]);
    setFile(null);
    try {
      const result = await api.call('import-media');
      if (result) {
        setSegments(result.segments);
        setFile(result.name);
        setElapsed(result.ms);
      }
    } finally {
      setImporting(false);
    }
  }
  return <><header className="page-heading"><div><h1>{audio ? t("实时听译") : t("屏幕字幕")}</h1><p>{audio ? t("听见原声，也听懂每一句。") : t("框选一处字幕，理解便会随画面发生。")}</p></div><span className={'status-chip ' + ((audio ? listening : screenState.active) ? 'active' : '')}>{(audio ? listening : screenState.active) ? screenState.paused && !audio ? t("已暂停") : t("正在监听") : t("未开启")}</span></header><ModelNotice settings={settings} aiEnabled={settings.aiEnabled} models={models} audio={audio} detectedSource={detectedSource} onOpen={onModels} /><section className="capture-workspace"><LanguageBar settings={settings} update={update} models={models} onSwap={() => run(swapLanguages)} swapDisabled={swapping || starting || importing || !swappedLanguageSettings(settings, detectedSource)} swapTitle={settings.source === 'auto' && !detectedSource ? t("先识别一段内容，或手动选择识别语言后交换") : settings.multiTarget ? t("交换识别语言与第一目标语言，继续实时翻译") : t("交换识别语言与翻译语言，继续实时翻译")} />{audio ? <div className="audio-body"><div className="segmented"><button disabled={listening || starting} className={source === 'system' ? 'selected' : ''} onClick={() => setSource('system')}><Headphones size={17} />{t("系统声音")}</button><button disabled={listening || starting} className={source === 'microphone' ? 'selected' : ''} onClick={() => setSource('microphone')}><Mic size={17} />{t("麦克风")}</button></div><div className={'wave ' + (listening ? 'listening' : '')}>{Array.from({
            length: 39
          }, (_, i) => <i key={i} style={{
            height: 8 + Math.sin(i * .7) ** 2 * (listening ? level * 95 + 10 : 28),
            opacity: .35 + Math.sin(i * .4) ** 2 * .65
          }} />)}</div><h2>{listening ? t("正在倾听…") : t("准备好，听懂下一句话")}</h2><p>{source === 'system' ? t("翻译电脑正在播放的会议、视频与声音。") : t("从当前默认麦克风识别并翻译。")}</p><button className={listening ? 'stop-button' : 'primary'} disabled={starting || importing} onClick={() => listening ? stop() : run(begin)}>{listening ? <Square size={16} /> : <Play size={16} />} {starting ? t("连接音频设备…") : listening ? t("停止听译") : t("开始听译")}</button><details className="capture-advanced"><summary>{t("延迟与识别设置")}<ChevronDown size={14} /></summary><label htmlFor="listening-seconds">{t("每次先听多久，再翻译 ")}<output>{t("{0} 秒", [settings.chunkSeconds])}</output></label><input id="listening-seconds" aria-label={t("每次先听多久再翻译")} disabled={listening || starting} type="range" min="2" max="8" step="1" value={settings.chunkSeconds} onChange={e => update({
            chunkSeconds: +e.target.value
          })} /><div className="audio-ticks">{[2, 3, 4, 5, 6, 7, 8].map(n => <span key={n}>{t("{0} 秒", [n])}</span>)}</div><p className="audio-guidance">{{
              2: t("更快跟上：适合简短对话；句子容易被截断，准确度可能降低。"),
              3: t("日常推荐：适合视频和聊天，兼顾出字幕速度与句子完整度。"),
              4: t("较完整的短句：适合一般会议，等待略长但语义更连贯。"),
              5: t("均衡听长句：适合讲解和访谈，给识别更多前后文。"),
              6: t("侧重理解：适合演讲和课程，较长句子更容易完整识别。"),
              7: t("更多前后文：适合语速平稳的长段讲述，字幕出现会更晚。"),
              8: t("优先完整性：适合长句和复杂表达，每次需要等待更久。")
            }[settings.chunkSeconds]}</p><p>{t("例如选 3 秒，会先收集约 3 秒声音，再识别并翻译。实际等待还包含识别与翻译处理时间，AI 模式也包含网络等待；调整后下次开始听译生效。")}</p></details>{elapsed != null && <div className="subtle">{t("最近处理耗时 {0} 秒{1}", [(elapsed / 1000).toFixed(1), dropped > 0 ? t(" · 已合并等待 {0} 次（可能漏掉过载期间的内容）", [dropped]) : ''])}</div>}</div> : <div className="screen-body"><div className="screen-illustration"><ScanLine size={54} strokeWidth={1} /><span>{t("你的识别文字区域")}</span></div><h2>{screenState.region ? t("识别文字区域已选定") : t("先告诉我，字幕在哪里")}</h2><p>{screenState.region ? t("{0} × {1} · 可以随时重新框选", [screenState.region.width, screenState.region.height]) : t("点击下方按钮，然后在桌面上拖动框选字幕。按 Esc 取消。")}</p><div className="button-row screen-controls"><button disabled={!!screenState.region} onClick={() => run(() => api.call('region'))}><ScanLine size={17} />{t("开始选框")}</button><button disabled={!screenState.region} onClick={() => run(() => api.call('region'))}><ScanLine size={17} />{t("重新选框")}</button><button className={screenState.active ? 'stop-button' : 'primary'} disabled={!screenState.region} onClick={() => run(() => api.call(screenState.active ? 'screen-stop' : 'screen-start'))}>{screenState.active ? <Square size={16} /> : <Play size={16} />} {screenState.active ? t("停止翻译") : t("开始翻译")}</button><button disabled={!screenState.active} onClick={() => run(() => api.call('screen-pause'))}>{screenState.paused ? <Play size={16} /> : <Pause size={16} />} {screenState.paused ? t("继续翻译") : t("暂停翻译")}</button></div><p className="subtle">{t("每次识别完成后约 650ms 再次检测 · 重复字幕自动去重")}</p></div>}</section>{audio && <section className="import-row"><FileAudio size={24} /><div><strong>{t("已有录音或视频？")}</strong><p>{file || t("直接导入，在这里生成逐句双语字幕。支持 MP3、WAV、MP4 等。")}</p></div><button disabled={importing || listening || starting} onClick={() => run(importFile)}><Upload size={16} />{importing ? t("正在翻译…") : t("导入文件")}</button>{file && <button onClick={() => run(() => api.call('export-srt'))}><Download size={16} />{t("导出 SRT")}</button>}</section>}<details className="appearance-disclosure"><summary>{t("字幕外观")}<ChevronDown size={16} /></summary><SubtitleSettings settings={settings} update={update} run={run} /></details>{audio && segments.length > 0 && <section className="transcript"><h2>{t("双语记录")}</h2><div className="transcript-scroll" tabIndex="0" aria-label={t("双语记录")}>{segments.map((s, i) => <div key={i}><p><FavoriteText text={s.text} terms={favoriteTerms} /></p>{(s.translations || [{
            target: s.target,
            translation: s.translation
          }]).map(targetRow => <div className="record-translation" key={targetRow.target}>{settings.multiTarget && <small>{languages[targetRow.target]}</small>}<strong><FavoriteText text={targetRow.translation} terms={favoriteTerms} /></strong></div>)}</div>)}</div></section>}</>;
}
