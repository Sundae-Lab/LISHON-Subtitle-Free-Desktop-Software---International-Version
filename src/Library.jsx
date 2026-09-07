import { t, localeTag } from "./i18n";
import React, { useEffect, useState } from 'react';
import { Heart, BookOpen, MessageSquare, Search, Trash2, ChevronLeft, ChevronRight, Check, Minus, Palette as PaletteIcon } from 'lucide-react';
import { api, languages as languageNames } from './bridge';
import { Gloss, LanguageBadge } from './LibraryGloss';
import { Toggle } from './components';
import Palette from './Palette';
export default function Library({
  settings,
  update
}) {
  const [languageFilter, setLanguageFilter] = useState([]),
    [filterOpen, setFilterOpen] = useState(false),
    [kind, setKind] = useState('favorite'),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('time'),
    [page, setPage] = useState(0),
    [data, setData] = useState({
      items: [],
      total: 0,
      count: 0,
      limit: 2000
    }),
    [selected, setSelected] = useState([]),
    [selecting, setSelecting] = useState(false),
    [colors, setColors] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => api.call('library', {
      kind,
      query,
      sort,
      page,
      languages: languageFilter,
      grouped: true
    }).then(r => {
      if (live) {
        setData(r);
        setSelected([]);
      }
    }).catch(e => live && setError(e.message)).finally(() => live && setBusy(false)), 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [kind, query, sort, page, revision, languageFilter]);
  async function index(enabled) {
    try {
      const r = await api.call('library', {
        action: 'index',
        enabled,
        kind,
        query,
        sort,
        page,
        languages: languageFilter,
        grouped: true
      });
      if (r.limitReached) {
        setError(t("需要先删除至少 {0} 条记录才能启用实时高亮；关闭时仍可继续收藏和检索。", [r.remove]));
        return;
      }
      setError('');
      setData(r);
      if (!enabled) setColors(false);
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove() {
    try {
      await api.call('library', {
        action: 'delete',
        ids: selected
      });
      setSelected([]);
      setPage(0);
      setRevision(v => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }
  const pageIds = data.items.flatMap(x => x.ids || [x.id]);
  const all = pageIds.length > 0 && pageIds.every(id => selected.includes(id));
  const selectPage = () => {
    if (!selecting) {
      setSelecting(true);
      return;
    }
    if (all) {
      setSelected([]);
      setSelecting(false);
    } else setSelected(pageIds);
  };
  const date = row => settings.libraryDates && <time dateTime={new Date(row.created).toISOString().slice(0, 10)}>{new Date(row.created).toLocaleDateString(localeTag())}</time>;
  const variants = row => row.variants || [row];
  const translations = row => {
    const seen = new Set();
    return variants(row).flatMap(v => v.details.translations?.length ? v.details.translations : [{
      target: v.target,
      translation: v.details.translation
    }]).filter(r => r.translation && (!languageFilter.length || languageFilter.includes(r.target)) && !seen.has(r.target + '|' + r.translation) && seen.add(r.target + '|' + r.translation));
  };
  const glosses = (row, compact) => <div className={'comparison-glosses ' + (variants(row).length > 1 ? 'comparing' : '')}>{variants(row).map(v => <div className="comparison-variant" key={v.id}><Gloss details={v.details} compact={compact} />{!compact && v.details.forms?.length > 0 && <div className="card-forms">{v.details.forms.map((f, i) => <span key={i}>{t(f.label)}：{f.word}　</span>)}</div>}</div>)}</div>;
  return <><header className="page-heading"><div><h1>{t("我的语库")}</h1><p>{t("把遇见的词句，留在自己的语言里。")}</p></div><span className="library-count">{t("{0} 条 · 本地保存", [data.count])}</span></header>
 <section className="library-index"><div><strong>{t("实时翻译中显示收藏的单词")}</strong><p>{t("开启后，最多索引 {0} 条语库记录。关闭实时高亮可继续收藏，关键词检索始终可用。", [data.limit])}</p></div><div className="library-index-actions"><Toggle label={t("实时翻译高亮收藏词")} checked={!!data.highlight} onChange={index} /><button className="icon-button" aria-label={t("收藏词高亮配色")} aria-expanded={colors} disabled={!data.highlight} onClick={() => setColors(!colors)}><PaletteIcon size={19} /></button></div></section>
 {colors && data.highlight && <div className="favorite-colors"><span>{t("文字颜色")}</span><Palette label={t("收藏词文字颜色")} value={settings.favoriteColor} onChange={favoriteColor => update({
        favoriteColor
      })} /><span>{t("背景颜色")}</span><Palette label={t("收藏词背景颜色")} value={settings.favoriteBackground} onChange={favoriteBackground => update({
        favoriteBackground
      })} /><mark style={{
        background: settings.favoriteBackground,
        color: settings.favoriteColor
      }}>{t("word 单词")}</mark></div>}
 {error && <div className="error-banner" role="alert">{t(error)}<button onClick={() => setError('')}>{t("知道了")}</button></div>}
 <section className="library-panel"><div className="library-tabs">{[['favorite', Heart, t("喜欢的单词")], ['word', BookOpen, t("单词卡片")], ['sentence', MessageSquare, t("句子卡片")]].map(([id, Icon, label]) => <button key={id} className={kind === id ? 'selected' : ''} onClick={() => {
          setData(old => ({
            ...old,
            items: []
          }));
          setKind(id);
          setPage(0);
          setSelecting(false);
          setSelected([]);
        }}><Icon size={17} />{label}</button>)}</div>
 <div className="library-tools"><label><Search size={17} /><input aria-label={t("检索语库")} placeholder={t("检索单词、句子或释义")} value={query} onChange={e => {
            setQuery(e.target.value);
            setPage(0);
          }} /></label><select aria-label={t("语库排序")} value={sort} onChange={e => {
          setSort(e.target.value);
          setPage(0);
        }}><option value="time">{t("按收藏时间")}</option><option value="alpha">{t("按开头字母")}</option></select><button aria-label={t("筛选译文语种")} aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>{languageFilter.length ? languageFilter.map(c => languageNames[c]).join(" · ") : t("全部语种")}</button><button disabled={!selected.length} onClick={remove}><Trash2 size={16} />{t("批量删除 ")}{selected.length || ''}</button></div>
 {filterOpen && <div className="language-filter" role="group" aria-label={t("译文语种筛选")}><button aria-pressed={!languageFilter.length} onClick={() => {
          setLanguageFilter([]);
          setPage(0);
        }}>{t("全部")}</button>{Object.entries(languageNames).map(([code, name]) => <button key={code} aria-pressed={languageFilter.includes(code)} onClick={() => {
          setLanguageFilter(old => old.includes(code) ? old.filter(c => c !== code) : [...old, code]);
          setPage(0);
          setSelected([]);
        }}>{name}</button>)}<small>{t("可多选；相同原文的不同语种译文并排对照。")}</small></div>}
 <div className="library-selection-tools"><button className="select-page-box" role="checkbox" aria-label={t("选择本页记录")} aria-checked={all ? 'true' : selecting ? 'mixed' : 'false'} onClick={selectPage}>{all ? <Check size={13} /> : selecting ? <Minus size={13} /> : null}</button><span>{t("选择本页")}</span><Toggle label={t("显示收藏日期")} checked={settings.libraryDates} onChange={libraryDates => update({
          libraryDates
        })} /><span>{t("显示收藏日期")}</span>{selecting && <button className="text-button" onClick={() => {
          setSelecting(false);
          setSelected([]);
        }}>{t("退出选择")}</button>}</div>
 <div aria-busy={busy} className={'library-records kind-' + kind}>{data.items.map(row => <article key={row.id} style={kind === 'sentence' ? {
          flexBasis: Math.min(620, Math.max(290, row.term.length * 3.5))
        } : undefined}>
 {selecting && <input className="record-checkbox" type="checkbox" aria-label={t("选择 ") + row.term} checked={(row.ids || [row.id]).every(id => selected.includes(id))} onChange={e => {
            const ids = row.ids || [row.id];
            setSelected(e.target.checked ? [...new Set([...selected, ...ids])] : selected.filter(x => !ids.includes(x)));
          }} />}
 <div>{kind === 'favorite' ? <><div className="favorite-line"><h3>{row.term}</h3>{glosses(row, true)}</div>{date(row)}</> : kind === 'word' ? <><h3>{row.term}</h3>{glosses(row, false)}{date(row)}</> : <><h3>{row.term}</h3><div className="library-translation">{translations(row).map((r, i) => <p key={i}><LanguageBadge code={r.target} /><span>{r.translation}</span></p>)}</div>{date(row)}</>}</div></article>)}
 {!busy && !data.items.length && <div className="library-empty"><BookOpen size={32} /><h3>{query ? t("没有找到对应记录") : t("从一个词，开始积累")}</h3><p>{t("在划词翻译中点击单词，或框选句子，添加到这里。")}</p></div>}</div>
 <div className="library-pagination"><span>{t("共 {0} 组", [data.total])}</span><button aria-label={t("语库上一页")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>{page + 1}</span><button aria-label={t("语库下一页")} disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></section></>;
}
