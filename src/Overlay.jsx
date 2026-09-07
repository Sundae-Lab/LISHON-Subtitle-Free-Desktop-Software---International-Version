import { t, localeTag } from "./i18n";
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { GripHorizontal, Languages, X, Contrast } from 'lucide-react';
import DesktopBackdrop from './DesktopBackdrop';
import { api, defaults } from './bridge';
import { FavoriteText } from './Words';
export default function Overlay() {
  const [settings, setSettings] = useState(defaults),
    [entries, setEntries] = useState([]),
    [settled, setSettled] = useState(false),
    [favorites, setFavorites] = useState([]);
  const content = useRef(),
    drag = useRef(null),
    frame = useRef(),
    pointerFrame = useRef(),
    lastPoint = useRef();
  useEffect(() => {
    api.call('bootstrap').then(d => {
      setSettings({
        ...defaults,
        ...d.settings
      });
      setEntries(d.captions || []);
      setFavorites(d.favoriteTerms || []);
    });
    const off = [api.on('settings', setSettings), api.on('library-index', setFavorites), api.on('result', r => {
      setEntries(old => r.text || r.translation ? [...old.filter(x => x.id !== 'blank' && (x.id !== r.id || !r.id)), r].slice(-3) : old.at(-1)?.id === 'blank' ? old : [...old, {
        id: 'blank',
        text: '',
        translation: ''
      }].slice(-3));
    }), api.on('overlay-moved', () => {
      setSettled(true);
      requestAnimationFrame(() => {
        if (content.current) api.call('overlay-fit', {
          height: content.current.getBoundingClientRect().height + 36,
          width: innerWidth
        }).catch(() => {});
      });
    })];
    return () => off.forEach(f => f());
  }, []);
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => api.call('overlay-fit', {
        height: el.getBoundingClientRect().height + 36,
        width: innerWidth
      }).catch(() => {}));
    };
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    measure();
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);
  const requested = settings.multiTarget ? settings.subtitleTargets : [{
    code: settings.target,
    fontSize: settings.fontSize
  }];
  const visible = entries.slice(-settings.lines);
  const unit = requested.reduce((n, targetRow) => n + targetRow.fontSize * 1.5 + 5, 0) + (settings.bilingual ? settings.fontSize * .64 * 1.5 : 0) + 10;
  const background = settings.backgroundColor;
  const rgb = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  const controls = !settings.backgroundEnabled || settings.backgroundOpacity === 0 ? '#808080' : rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? '#252525' : '#ffffff';
  const alpha = settings.backgroundEnabled ? settings.backgroundOpacity / 100 : 0;
  const begin = (e, kind) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = kind;
    setSettled(false);
    api.call('overlay-interact', {
      action: 'start',
      kind,
      point: {
        x: e.screenX,
        y: e.screenY
      }
    });
  };
  const flush = () => {
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    if (lastPoint.current) {
      api.call('overlay-interact', {
        action: 'move',
        point: lastPoint.current
      });
      lastPoint.current = null;
    }
  };
  const move = e => {
    if (drag.current) {
      lastPoint.current = {
        x: e.screenX,
        y: e.screenY
      };
      if (!pointerFrame.current) pointerFrame.current = requestAnimationFrame(flush);
    }
  };
  const end = () => {
    if (drag.current) {
      flush();
      drag.current = null;
      setSettled(true);
      api.call('overlay-interact', {
        action: 'end'
      });
    }
  };
  return <div className={'overlay-shell ' + (!settings.backgroundEnabled ? 'text-only ' : '') + (!settings.textShadow ? 'no-text-shadow' : '')} style={{
    fontFamily: settings.fontFamily,
    color: settings.textColor,
    '--handle-alpha': Math.max(.04, alpha * .38),
    '--controls-color': controls,
    '--favorite-bg': settings.favoriteBackground,
    '--favorite-color': settings.favoriteColor
  }}>
 <DesktopBackdrop enabled={settings.allowSubtitleCapture === false && settings.backgroundEnabled && settings.backgroundBlur && settings.backgroundOpacity < 100} level={settings.blurLevel} /><div className="overlay-tint" style={{
      backgroundColor: background + Math.round(alpha * 255).toString(16).padStart(2, '0')
    }} />
 <div className={'overlay-handle ' + (settled ? 'settled' : '')} onPointerEnter={() => setSettled(false)} onPointerLeave={() => {
      if (!drag.current) setSettled(false);
    }} onPointerDown={e => begin(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
 <div className="overlay-drag-region" title={t("拖动移动字幕")}><GripHorizontal size={18} /></div><div className="overlay-actions">
 <button aria-label={t("交换文字与背景颜色")} title={t("交换文字与背景颜色")} onClick={() => api.call('overlay', {
          action: 'invert'
        })}><Contrast size={16} /></button>
 <button aria-label={settings.bilingual ? t("只显示译文") : t("同时显示原文")} title={settings.bilingual ? t("只显示译文") : t("同时显示原文")} onClick={() => api.call('overlay', {
          action: 'toggle-original'
        })}><Languages size={16} /></button>
 <button aria-label={t("关闭字幕")} title={t("关闭字幕")} onClick={() => api.call('overlay', {
          action: 'close'
        })}><X size={16} /></button></div></div>
 <div ref={content} className="overlay-content">
 {Array.from({
        length: Math.max(0, settings.lines - visible.length)
      }, (_, i) => <div key={'empty' + i} className="caption-empty" style={{
        height: unit
      }} />)}
 {visible.map((r, i) => <div className="caption-entry" key={r.id || i} style={{
        minHeight: unit
      }}>
 {settings.bilingual && r.text && <div className="overlay-original" style={{
          fontSize: settings.fontSize * .64
        }}><FavoriteText text={r.text} terms={favorites} /></div>}
 {requested.map(targetRow => {
          const text = r.translations?.find(x => x.target === targetRow.code)?.translation ?? (!r.translations && requested.length === 1 ? r.translation : '');
          return text ? <div className="overlay-language" lang={targetRow.code} key={targetRow.code}><div className="overlay-translation" style={{
              fontSize: targetRow.fontSize,
              color: targetRow.textColor || settings.textColor
            }}><FavoriteText text={text} terms={favorites} /></div></div> : null;
        })}</div>)}
 </div>
 <div className="overlay-resize-right" title={t("拖动调整字幕宽度 · 20 档")} onPointerDown={e => begin(e, 'width')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
 <div className="overlay-resize-bottom" title={t("拖动调整历史行数 · 1–3 行")} onPointerDown={e => begin(e, 'lines')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
 </div>;
}
