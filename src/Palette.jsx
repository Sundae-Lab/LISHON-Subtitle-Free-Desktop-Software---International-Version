import { t, localeTag } from "./i18n";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
export const palette = ['#ffffff', '#e7e7e7', '#b0b0b0', '#595959', '#1a1a1a', '#fff6b6', '#f8d3af', '#ffc6c6', '#adf0c7', '#c6dcff', '#dedaff', '#ffdc4a', '#fe9f4d', '#ff6464', '#2dc75c', '#659df2', '#8f7fee', '#af7e04', '#9b4a08', '#bd0a0a', '#067429', '#305bab', '#6631d7'];
export default function Palette({
  label,
  value,
  onChange,
  disabled = false
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({}),
    button = useRef(),
    panel = useRef();
  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (!button.current?.contains(e.target) && !panel.current?.contains(e.target)) setOpen(false);
    };
    const key = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return <><button ref={button} className="palette-trigger" aria-label={label} disabled={disabled} aria-expanded={open} onClick={() => {
      const b = button.current.getBoundingClientRect();
      setPosition({
        left: Math.max(12, Math.min(innerWidth - 360, b.right - 350)),
        top: b.bottom + 180 > innerHeight ? b.top - 172 : b.bottom + 8
      });
      setOpen(!open);
    }}><span style={{
        background: value
      }} /></button>
 {open && !disabled && createPortal(<div className="palette-popover" ref={panel} role="dialog" aria-label={label + t("选择")} style={position}><small>{label}</small><div className="palette-grid">{palette.map((color, i) => <button key={i} aria-label={color} aria-pressed={value === color} style={{
          background: color,
          color: parseInt(color.slice(1, 3), 16) * .299 + parseInt(color.slice(3, 5), 16) * .587 + parseInt(color.slice(5, 7), 16) * .114 > 155 ? '#111' : '#fff'
        }} onClick={() => {
          onChange(color);
          setOpen(false);
        }}>{value === color && <Check size={18} />}</button>)}</div></div>, document.body)}</>;
}
