import { t, localeTag } from "./i18n";
import React, { useEffect, useRef, useState } from 'react';
import { Minus, Power, X, ChevronRight } from 'lucide-react';
import { api } from './bridge';
import mark from './assets/lishon-mark.png';
export default function CloseDialog({
  onDismiss
}) {
  const dialog = useRef(null),
    pending = useRef(false);
  const [remember, setRemember] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current,
      previous = document.activeElement;
    node.showModal();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  async function choose(choice) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await api.call('window', {
        action: 'close-choice',
        choice,
        remember
      });
      onDismiss();
    } catch (e) {
      setError(e.message || t("暂时无法完成操作，请重试。"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <dialog ref={dialog} className="close-dialog" aria-labelledby="close-title" aria-describedby="close-description" onCancel={e => {
    e.preventDefault();
    choose('cancel');
  }}>
  <button className="close-dialog-dismiss" aria-label={t("取消关闭")} disabled={busy} onClick={() => choose('cancel')}><X size={18} /></button>
  <div className="close-dialog-brand"><img src={mark} alt="" /><span>{t("听现 ")}<b>Lishon</b></span></div>
  <h2 id="close-title">{t("如何关闭听现？")}</h2>
  <p id="close-description">{t("暂时离开，或结束本次使用。")}</p>
  <div className="close-dialog-options">
   <button className="close-option" disabled={busy} onClick={() => choose('minimize')}><span className="close-option-icon"><Minus size={23} /></span><span className="close-option-copy"><strong>{t("最小化")}</strong><small>{t("收起窗口，翻译继续进行")}</small></span><ChevronRight size={18} /></button>
   <button className="close-option" disabled={busy} onClick={() => choose('quit')}><span className="close-option-icon"><Power size={21} /></span><span className="close-option-copy"><strong>{t("退出软件")}</strong><small>{t("结束本次使用，停止识别与监听")}</small></span><ChevronRight size={18} /></button>
  </div>
  {error && <p className="close-dialog-error" role="alert">{t(error)}</p>}
  <div className="close-dialog-footer"><label><input type="checkbox" checked={remember} disabled={busy} onChange={e => setRemember(e.target.checked)} /><span>{t("记住我的选择")}</span></label><button disabled={busy} onClick={() => choose('cancel')}>{t("取消")}</button></div>
  <p className="close-dialog-hint">{t("之后可在「设置 · 窗口行为」中修改")}</p>
 </dialog>;
}
