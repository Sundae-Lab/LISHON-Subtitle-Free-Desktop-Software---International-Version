import { t, localeTag } from "./i18n";
import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, LoaderCircle } from 'lucide-react';
export function readSentence(container, side, target) {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return null;
  const range = sel.getRangeAt(0).cloneRange(),
    before = range.cloneRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  return {
    text: range.toString(),
    start: before.toString().length,
    end: before.toString().length + range.toString().length,
    range,
    container,
    side,
    target
  };
}
export default function SentenceButton({
  selection,
  saved,
  busy,
  onAdd
}) {
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    if (!selection?.range) return;
    let frame;
    const measure = () => {
      const {
        range,
        container
      } = selection;
      if (!container.isConnected) {
        setPosition(null);
        return;
      }
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0),
        r = rects.at(-1);
      if (!r) {
        setPosition(null);
        return;
      }
      let top = 0,
        bottom = innerHeight,
        left = 0,
        right = innerWidth;
      for (let el = container; el; el = el.parentElement) {
        if (/auto|scroll|hidden/.test(getComputedStyle(el).overflowY)) {
          const b = el.getBoundingClientRect();
          top = Math.max(top, b.top);
          bottom = Math.min(bottom, b.bottom);
          left = Math.max(left, b.left);
          right = Math.min(right, b.right);
        }
      }
      if (r.bottom < top || r.top > bottom || r.right < left || r.left > right) {
        setPosition(null);
        return;
      }
      setPosition({
        left: Math.max(8, Math.min(right - 40, r.right + 8)),
        top: Math.min(innerHeight - 44, r.bottom + 7)
      });
    };
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', queue, true);
    window.addEventListener('resize', queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', queue, true);
      window.removeEventListener('resize', queue);
    };
  }, [selection]);
  return position && createPortal(<button className={'sentence-add ' + (saved ? 'saved' : '')} style={position} aria-label={saved ? t("句子已收藏") : t("添加句子卡片")} title={saved ? t("已加入句子卡片") : t("收藏这句原文与译文")} disabled={busy || saved} onPointerDown={e => e.preventDefault()} onClick={onAdd}>{saved ? <Check size={18} strokeWidth={2.5} /> : busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={18} />}</button>, document.body);
}
