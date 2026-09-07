import { t, localeTag, currentLocale } from "./i18n";
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { languages } from './bridge';
export function LanguageBadge({
  code
}) {
  const label=currentLocale()==='zh'?({en:'英',zh:'中',ja:'日',ko:'韩',fr:'法',de:'德',es:'西',ru:'俄'}[code]||'译'):(code||'—').toUpperCase();
  return <span className="language-badge" title={languages[code] || code} aria-label={languages[code] || code}>{label}</span>;
}
export function Gloss({
  details,
  compact = false
}) {
  const [expanded, setExpanded] = useState(false),
    [overflow, setOverflow] = useState(false),
    content = useRef();
  useEffect(() => setExpanded(false), [details]);
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const check = () => {
      if (!expanded) setOverflow(el.scrollWidth > el.clientWidth + 1);
    };
    const observer = new ResizeObserver(check);
    observer.observe(el);
    check();
    return () => observer.disconnect();
  }, [details, expanded]);
  return <div className={'gloss ' + (compact ? 'compact ' : '') + (expanded ? 'expanded' : '')}>
  <div ref={content} className="gloss-content">{details.senses?.length ? details.senses.map((s, i) => <React.Fragment key={i}><span className="gloss-sense"><b>{t(s.pos) || t("释义")}</b> {s.meaning}</span>{i < details.senses.length - 1 ? '　' : ''}</React.Fragment>) : t("暂无词典释义")}</div>
  {compact && (overflow || expanded) && <button className="gloss-expand" aria-label={expanded ? t("收起完整释义") : t("展开完整释义")} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '▴' : '...'}</button>}
 </div>;
}
