import { t, localeTag } from "./i18n";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Plus, X, Trash2, Copy, ChevronRight } from 'lucide-react';
import { api, languages } from './bridge';
import SentenceButton, { readSentence } from './SentenceButton';
import phraseList from '../engine/data/phrases.json';
const phraseTrie = {};
for (const phrase of phraseList) {
  let node = phraseTrie;
  for (const c of phrase) {
    node[c] ??= {};
    node = node[c];
  }
  node.$ = true;
}
function phraseEnd(text, start) {
  let node = phraseTrie,
    end = 0;
  for (let j = start; j < Math.min(text.length, start + 64); j++) {
    node = node[text[j].toLowerCase()];
    if (!node) break;
    if (node.$ && !/[\p{L}]/u.test(text[j + 1] || '')) end = j + 1;
  }
  return end;
}
const segmenter = new Intl.Segmenter(undefined, {
  granularity: 'word'
});
export function tokens(text = '') {
  const parts = Array.from(segmenter.segment(text), s => ({
    text: s.segment,
    start: s.index,
    end: s.index + s.segment.length,
    word: s.isWordLike
  }));
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i],
      end = p.word && phraseEnd(text, p.start);
    if (end) {
      out.push({
        ...p,
        text: text.slice(p.start, end),
        end
      });
      while (parts[i + 1]?.start < end) i++;
    } else out.push(p);
  }
  return out;
}
export function FavoriteText({
  text = '',
  terms = []
}) {
  const index = useMemo(() => {
    const root = {};
    for (const term of terms) {
      let node = root;
      for (const ch of term.toLocaleLowerCase()) {
        node[ch] ??= {};
        node = node[ch];
      }
      node.$ = true;
    }
    return root;
  }, [terms]);
  const parts = Array.from(segmenter.segment(text), s => ({
      text: s.segment,
      start: s.index,
      end: s.index + s.segment.length
    })),
    out = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let node = index,
      end = 0;
    for (let j = p.start; j < text.length && j < p.start + 100; j++) {
      node = node[text[j].toLocaleLowerCase()];
      if (!node) break;
      if (node.$ && (!/[a-z]/i.test(text[j]) || !/[a-z]/i.test(text[j + 1] || ''))) end = j + 1;
    }
    if (end) {
      out.push(<mark className="favorite-word" key={i}>{text.slice(p.start, end)}</mark>);
      while (parts[i + 1]?.start < end) i++;
    } else out.push(<React.Fragment key={i}>{p.text}</React.Fragment>);
  }
  return out;
}
const overlap = (p, r) => r && p.end > r.start && p.start < r.end;
function SourceEditor({
  text,
  onChange,
  onHover,
  onWord,
  onSelect,
  range,
  active,
  height,
  fontSize
}) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current,
      sel = getSelection();
    let caret = null;
    if (document.activeElement === el && sel?.isCollapsed && el.contains(sel.anchorNode) && el.innerText === text) {
      const r = sel.getRangeAt(0).cloneRange();
      r.selectNodeContents(el);
      r.setEnd(sel.anchorNode, sel.anchorOffset);
      caret = r.toString().length;
    }
    el.replaceChildren(...tokens(text).map(p => {
      const span = document.createElement('span');
      span.textContent = p.text;
      if (p.word) {
        span.dataset.start = p.start;
        span.dataset.end = p.end;
        span.className = 'word-token';
      }
      return span;
    }));
    if (caret !== null) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while (n = walker.nextNode()) {
        if (caret <= n.length) {
          const r = document.createRange();
          r.setStart(n, caret);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          break;
        }
        caret -= n.length;
      }
    }
  }, [text]);
  useEffect(() => {
    for (const el of ref.current.querySelectorAll('[data-start]')) {
      const p = {
        start: +el.dataset.start,
        end: +el.dataset.end
      };
      el.classList.toggle('word-hover', !!overlap(p, range));
      el.classList.toggle('word-active', !!overlap(p, active));
    }
  }, [range, active, text]);
  const hit = e => {
    const el = e.target.closest('[data-start]');
    return el ? {
      term: el.textContent,
      start: +el.dataset.start,
      end: +el.dataset.end,
      rect: el.getBoundingClientRect(),
      element: el
    } : null;
  };
  return <div ref={ref} id="source-text" role="textbox" aria-label={t("原文")} aria-multiline="true" contentEditable="plaintext-only" suppressContentEditableWarning className="source-editor" style={{
    height,
    fontSize
  }} data-placeholder={t("输入或粘贴文字，也可以开启自动划词…")} onInput={e => onChange(e.currentTarget.innerText.slice(0, 5000))} onMouseMove={e => {
    const h = hit(e);
    onHover(h);
  }} onMouseLeave={() => onHover(null)} onClick={e => {
    if (getSelection()?.toString()) return;
    const h = hit(e);
    if (h) onWord(h);
  }} onMouseUp={() => onSelect(readSentence(ref.current, 'source'))} />;
}
export default function WordWorkspace({
  text,
  setText,
  result,
  settings,
  busy,
  onTranslate
}) {
  const [hover, updateHover] = useState(null),
    [active, setActive] = useState(null),
    [popup, setPopup] = useState(null),
    [entry, setEntry] = useState(null),
    [selection, setSelection] = useState(null),
    [notice, setNotice] = useState(''),
    [limit, setLimit] = useState(null),
    [height, setHeight] = useState(290),
    [saved, setSaved] = useState({}),
    [nativeSelection, setNativeSelection] = useState(false),
    [sentenceBusy, setSentenceBusy] = useState(false);
  const workspace = useRef();
  const chooseSentence = value => {
    setSelection(value);
    setHover(null);
    setActive(null);
    setPopup(null);
    setSaved({});
  };
  useEffect(() => {
    const changed = () => {
      const s = getSelection(),
        chosen = !!s && !s.isCollapsed && workspace.current?.contains(s.anchorNode);
      setNativeSelection(chosen);
      if (chosen) updateHover(null);
    };
    document.addEventListener('selectionchange', changed);
    return () => document.removeEventListener('selectionchange', changed);
  }, []);
  const setHover = value => updateHover(old => old?.start === value?.start && old?.end === value?.end && old?.side === value?.side && old?.target === value?.target ? old : value);
  const version = useRef(0),
    resize = useRef(null),
    popupRef = useRef();
  const rows = result?.translations?.length ? result.translations : [{
    translation: result?.translation,
    target: settings.target
  }];
  // Measure the actual dialog after definitions arrive; do not assume a 330px height.
  useLayoutEffect(() => {
    if (!popup || !popupRef.current) return;
    const box = popupRef.current;
    let frame;
    const place = () => {
      const margin = 16,
        viewportWidth = document.documentElement.clientWidth,
        viewportHeight = innerHeight;
      box.style.maxHeight = `${Math.min(660, viewportHeight - margin * 2)}px`;
      const anchor = popup.anchor?.isConnected ? popup.anchor.getBoundingClientRect() : popup.rect;
      const {
        width,
        height
      } = box.getBoundingClientRect();
      let top = anchor.bottom + 10;
      if (top + height > viewportHeight - margin && anchor.top - height - 10 >= margin) top = anchor.top - height - 10;
      box.style.left = `${Math.max(margin, Math.min(anchor.left, viewportWidth - width - margin))}px`;
      box.style.top = `${Math.max(margin, Math.min(top, viewportHeight - height - margin))}px`;
      box.style.visibility = 'visible';
    };
    const schedule = e => {
      if (e?.target instanceof Node && box.contains(e.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    const observer = new ResizeObserver(() => schedule());
    observer.observe(box);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [popup, entry, notice]);
  useEffect(() => {
    version.current++;
    setPopup(null);
    setActive(null);
    setSelection(null);
    setHover(null);
  }, [text]);
  useEffect(() => {
    setSelection(old => old?.side === 'target' ? null : old);
    setHover(null);
  }, [result]);
  useEffect(() => {
    const close = e => {
      if (popupRef.current?.contains(e.target) || e.target.closest('.word-token,.sentence-add')) return;
      setPopup(null);
      setActive(null);
      setSelection(null);
      updateHover(null);
    };
    const key = e => {
      if (e.key === 'Escape') {
        setPopup(null);
        setSelection(null);
        setActive(null);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, []);
  async function word(p, side = 'source', target = settings.target) {
    const ticket = ++version.current;
    setActive({
      ...p,
      side,
      target
    });
    setHover(null);
    setSaved({});
    setEntry(null);
    setNotice('');
    setPopup({
      anchor: p.element,
      rect: p.rect,
      term: p.term
    });
    try {
      const e = await api.call('lookup', {
        term: p.term,
        source: side === 'source' ? settings.source : target,
        target: side === 'source' ? target : settings.source === 'auto' ? 'en' : settings.source
      });
      if (ticket === version.current) setEntry(e);
    } catch (e) {
      if (ticket === version.current) setEntry({
        found: false,
        note: e.message,
        senses: []
      });
    }
  }
  async function add(args) {
    try {
      const r = await api.call('library', {
        action: 'add',
        ...args
      });
      if (r.limitReached) {
        setLimit({
          args,
          ...r
        });
        return;
      }
      setNotice(t("已保存到我的语库"));
      setSaved(old => ({
        ...old,
        [args.kind]: true
      }));
      if (args.kind !== 'sentence') setSelection(null);
      return true;
    } catch (e) {
      setNotice(e.message);
      return false;
    }
  }
  const targetTokens = useMemo(() => Object.fromEntries(rows.map(row => [row.target, tokens(row.translation)])), [result, settings.target]);
  const canHover = !selection && !nativeSelection;
  const sourceRange = canHover && hover?.side !== 'target' ? hover : null;
  function targetRanges(row) {
    if (!sourceRange) return [];
    return (row.alignment || []).filter(a => a.s1 > sourceRange.start && a.s0 < sourceRange.end).map(a => ({
      start: a.t0,
      end: a.t1
    }));
  }
  const sourceForTarget = () => {
    const h = canHover ? hover : null;
    if (h?.side !== 'target') return sourceRange;
    const row = rows.find(r => r.target === h.target);
    const a = (row?.alignment || []).filter(a => a.t1 > h.start && a.t0 < h.end);
    return a.length ? {
      start: Math.min(...a.map(x => x.s0)),
      end: Math.max(...a.map(x => x.s1))
    } : null;
  };
  return <><div ref={workspace} className={'bilingual word-workspace ' + (!canHover ? 'selecting-sentence' : '')} onKeyDown={e => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        onTranslate();
      }
    }}><div className="language-pane"><div className="source-heading"><label htmlFor="source-text">{t("原文")}</label><button className="icon-button" aria-label={t("清空原文和译文")} title={t("清空原文和译文")} disabled={!text} onClick={() => setText('')}><Trash2 size={15} /></button></div><SourceEditor text={text} onChange={setText} onHover={p => setHover(p ? {
          ...p,
          side: 'source'
        } : null)} onWord={p => word(p, 'source', rows[0]?.target || settings.target)} onSelect={chooseSentence} range={sourceForTarget()} active={canHover && active?.side === 'source' ? active : null} height={height} fontSize={{
          small: 16,
          medium: 22,
          large: 28
        }[settings.editorSourceSize] || 22} /></div>
 <div className="language-pane"><div className="pane-label"><span>{t("译文")}</span>{result && <button className="icon-button" aria-label={t("复制译文")} onClick={() => api.call('copy', {
            text: rows.map(r => r.translation).join('\n')
          })}><Copy size={15} /></button>}</div><div className={'translated ' + (!result ? 'empty' : '')} style={{
          height,
          fontSize: {
            small: 16,
            medium: 22,
            large: 28
          }[settings.editorTargetSize] || 22
        }} aria-live="polite">{busy ? settings.aiEnabled ? t("AI 正在理解并翻译…") : t("正在本地翻译…") : result ? rows.map(row => {
            const ranges = targetRanges(row);
            return <div className="translated-language" key={row.target}>{settings.multiTarget && <small>{languages[row.target]}</small>}<div className="target-text" data-target={row.target} onMouseUp={e => chooseSentence(readSentence(e.currentTarget, 'target', row.target))}>{(targetTokens[row.target] || []).map((p, i) => <span key={i} className={(p.word ? 'word-token ' : '') + (ranges.some(r => overlap(p, r)) ? 'word-hover ' : '') + (canHover && hover?.side === 'target' && hover.target === row.target && overlap(p, hover) ? 'word-hover ' : '') + (canHover && active?.side === 'target' && active.target === row.target && overlap(p, active) ? 'word-active' : '')} onMouseEnter={() => p.word && setHover({
                  ...p,
                  side: 'target',
                  target: row.target
                })} onMouseLeave={() => setHover(null)} onClick={e => !getSelection()?.toString() && p.word && word({
                  ...p,
                  term: p.text,
                  rect: e.currentTarget.getBoundingClientRect(),
                  element: e.currentTarget
                }, 'target', row.target)}>{p.text}</span>)}</div></div>;
          }) : t("译文会显示在这里")}</div></div></div>
 <div className="workspace-resize" title={t("拖动调整文本窗口高度")} onPointerDown={e => {
      e.currentTarget.setPointerCapture(e.pointerId);
      resize.current = {
        y: e.clientY,
        height
      };
    }} onPointerMove={e => {
      if (resize.current) setHeight(Math.max(180, Math.min(1200, resize.current.height + e.clientY - resize.current.y)));
    }} onPointerUp={() => resize.current = null} />
 <div className="workspace-footer"><span>{text.length} / 5000</span><span className="word-notice" role="status">{t(notice)}</span><div className="inline"><span className="subtle">{t("点击单词查义 · 框选句子收藏")}</span><button className="primary" disabled={busy || !text.trim()} onClick={onTranslate}>{t("翻译")}<ChevronRight size={16} /></button></div></div>
 {popup && createPortal(<div ref={popupRef} role="dialog" aria-label={t("词典释义")} className="word-popup" style={{
      left: 16,
      top: 16,
      visibility: 'hidden'
    }}><header><div><strong>{popup.term}</strong>{entry?.phonetic && <small>/{entry.phonetic}/</small>}</div><div><button aria-label={t("喜欢此单词")} aria-pressed={!!saved.favorite} disabled={!entry} onClick={() => add({
            kind: 'favorite',
            term: popup.term,
            source: entry.source || settings.source,
            target: entry.target || settings.target,
            details: entry
          })}><Heart size={18} fill={saved.favorite ? 'currentColor' : 'none'} /></button><button aria-label={t("添加单词卡片")} disabled={!entry?.found} onClick={() => add({
            kind: 'word',
            term: popup.term,
            source: entry.source,
            target: entry.target,
            details: entry
          })}><Plus size={18} /></button><button aria-label={t("关闭词典")} onClick={() => {
            setPopup(null);
            setActive(null);
          }}><X size={17} /></button></div></header>{settings.multiTarget && active?.side === 'source' && <select aria-label={t("词典目标语言")} value={active.target} onChange={e => word(active, 'source', e.target.value)}>{settings.subtitleTargets.map(targetRow => <option value={targetRow.code} key={targetRow.code}>{languages[targetRow.code]}</option>)}</select>}<div className="word-senses" tabIndex={0} aria-label={t("完整词性与释义")}>{!entry ? <p>{t("正在查询本地词典…")}</p> : <>{entry.senses?.map((s, i) => <div className="word-sense" key={i}><b>{t(s.pos)}</b><span title={s.original || undefined}>{s.meaning}</span></div>)}{entry.forms?.length > 0 && <div className="word-forms">{entry.forms.map((f, i) => <span key={i}>{t(f.label)}：{f.word}</span>)}</div>}<small>{t(entry.note)}</small></>}</div>{notice && <div className="word-popup-status" role="status">{t(notice)}</div>}</div>, document.body)}
 {selection?.text?.trim() && <SentenceButton selection={selection} saved={saved.sentence} busy={sentenceBusy} onAdd={async () => {
      const chosen = selection;
      setSentenceBusy(true);
      try {
        let original = chosen.text,
          translated;
        if (chosen.side === 'target') {
          const row = rows.find(r => r.target === chosen.target),
            aligned = (row?.alignment || []).filter(a => a.t1 > chosen.start && a.t0 < chosen.end);
          if (aligned.length) original = text.slice(Math.min(...aligned.map(a => a.s0)), Math.max(...aligned.map(a => a.s1)));else if (chosen.text.trim() === row?.translation?.trim()) original = text;else {
            const reverse = await api.call('translate-selection', {
              text: chosen.text,
              source: chosen.target,
              target: result.source === 'auto' ? 'en' : result.source,
              targets: [result.source === 'auto' ? 'en' : result.source]
            });
            original = reverse.translation;
          }
          translated = {
            text: original,
            source: result.source,
            target: chosen.target,
            translation: chosen.text,
            translations: [{
              target: chosen.target,
              translation: chosen.text
            }]
          };
        } else translated = await api.call('translate-selection', {
          text: chosen.text
        });
        await add({
          kind: 'sentence',
          term: original,
          source: translated.source,
          target: translated.target,
          details: translated
        });
      } catch (e) {
        setNotice(e.message);
      } finally {
        setSentenceBusy(false);
      }
    }} />}
 {limit && createPortal(<div className="library-limit" role="dialog" aria-label={t("索引数量上限")}><strong>{t("实时高亮索引已达 {0} 条", [limit.limit])}</strong><p>{t("可关闭实时索引继续收藏；或先在我的语库删除至少 {0} 条记录。", [limit.remove])}</p><button onClick={async () => {
        await api.call('library', {
          action: 'index',
          enabled: false
        });
        const args = limit.args;
        setLimit(null);
        await add(args);
      }}>{t("关闭实时索引并收藏")}</button><button onClick={() => setLimit(null)}>{t("保留索引，先整理记录")}</button></div>, document.body)}
 </>;
}
