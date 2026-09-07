import { t, localeTag } from "./i18n";
import React, { useEffect, useRef } from 'react';
import { api } from './bridge';
export default function RegionHandle() {
  useEffect(() => api.on('settings', () => {}), []);
  const drag = useRef(false),
    frame = useRef(0),
    last = useRef();
  const corner = new URLSearchParams(location.search).get('corner');
  const flush = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (last.current) {
      api.call('region-interact', {
        action: 'move',
        point: last.current
      });
      last.current = null;
    }
  };
  const end = () => {
    if (!drag.current) return;
    flush();
    drag.current = false;
    api.call('region-interact', {
      action: 'end'
    });
  };
  return <div className={'region-corner ' + corner} title={t("拖动调整识别范围：先横移调整宽度，先竖移调整高度")} onPointerDown={e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = true;
    api.call('region-interact', {
      action: 'start',
      point: {
        x: e.screenX,
        y: e.screenY
      }
    });
  }} onPointerMove={e => {
    if (drag.current) {
      last.current = {
        x: e.screenX,
        y: e.screenY
      };
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    }
  }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}><i /></div>;
}
