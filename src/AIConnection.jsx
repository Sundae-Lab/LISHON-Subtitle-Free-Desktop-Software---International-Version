import { t, localeTag } from "./i18n";
import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowUpRight, Check, KeyRound, LoaderCircle, ShieldCheck, PlugZap, ChevronDown, Trash2 } from 'lucide-react';
import { api, desktop } from './bridge';
import { Toggle } from './components';
import providers from '../electron/ai-providers.json';
const initial = {
  ...providers[0],
  provider: providers[0].id,
  enabled: false,
  context: true,
  quality: 'realtime',
  hasKey: false,
  apiKey: ''
};
export default function AIConnection() {
  const [saved, setSaved] = useState(null),
    [form, setForm] = useState(initial),
    [busy, setBusy] = useState(''),
    [feedback, setFeedback] = useState(null),
    [advanced, setAdvanced] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const selected = providers.find(p => p.id === form.provider) || providers[0];
  useEffect(() => {
    let live = true;
    const receive = value => {
      if (live) {
        setSaved(value);
        setForm({
          ...value,
          apiKey: ''
        });
      }
    };
    if (desktop) api.call('ai-status').then(receive).catch(e => setFeedback({
      error: true,
      text: e.message
    }));
    const off = api.on('ai-state', receive);
    return () => {
      live = false;
      off();
    };
  }, []);
  const retained = saved?.hasKey && saved.provider === form.provider && saved.baseUrl.replace(/\/+$/, '') === form.baseUrl.replace(/\/+$/, '');
  const ready = !!form.model.trim() && !!form.baseUrl.trim() && (!!form.apiKey.trim() || retained);
  const edit = part => {
    setForm(old => ({
      ...old,
      ...part
    }));
    setFeedback(null);
  };
  async function act(action) {
    setBusy(action);
    setFeedback(null);
    try {
      if (action === 'test') {
        const result = await api.call('ai-test', form);
        setFeedback({
          text: t("连接成功 · {0} 秒", [(result.ms / 1000).toFixed(2)]),
          sample: result.translation
        });
      }
      if (action === 'save') {
        const value = await api.call('ai-save', {
          ...form,
          enabled: true
        });
        setSaved(value);
        setForm({
          ...value,
          apiKey: ''
        });
        setFeedback({
          text: t("已保存并启用，新的翻译将使用 AI。")
        });
      }
      if (action === 'toggle') {
        const value = await api.call('ai-enable', {
          enabled: !saved.enabled
        });
        setSaved(value);
        setForm({
          ...value,
          apiKey: ''
        });
        setFeedback({
          text: value.enabled ? t("已启用 AI 翻译。") : t("已切回本地翻译。")
        });
      }
      if (action === 'forget') {
        const value = await api.call('ai-forget');
        setSaved(value);
        setForm({
          ...value,
          apiKey: ''
        });
        setConfirmDelete(false);
        setFeedback({
          text: t("已删除保存的 API Key，并切回本地翻译。")
        });
      }
    } catch (e) {
      setFeedback({
        error: true,
        text: e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
      });
    } finally {
      setBusy('');
    }
  }
  return <div className="ai-page"><header className="page-heading"><div><h1>{t("接入 AI")}</h1><p>{t("让翻译理解语境，也理解言外之意。")}</p></div><span className={'ai-state ' + (saved?.enabled ? 'enabled' : '')}><i />{saved?.enabled ? t("AI 翻译已启用") : t("当前使用本地翻译")}</span></header>
 <div className="ai-intro"><span className="ai-emblem"><Sparkles size={27} strokeWidth={1.5} /></span><div><strong>{t("你的模型，听现的翻译 Agent")}</strong><p>{t("连接自己的 API，让划词、屏幕字幕和听译共享更连贯的表达。")}</p></div></div>
 <section className="ai-provider-section" aria-labelledby="ai-provider-title"><div className="ai-section-title"><h2 id="ai-provider-title"><span>01</span>{t(" 选择服务商")}</h2><span>{t("使用开放平台 API Key")}</span></div><div className="ai-providers">{providers.map((p, i) => <button key={p.id} aria-pressed={form.provider === p.id} disabled={!!busy} className={'ai-provider ' + (form.provider === p.id ? 'selected' : '')} onClick={() => {
          edit({
            provider: p.id,
            baseUrl: p.baseUrl,
            model: p.model,
            apiKey: ''
          });
          setAdvanced(p.id === 'custom');
          setConfirmDelete(false);
        }}><span className="ai-provider-mark">{['D', t("千"), 'K', 'O', 'G', 'C', '+'][i]}</span><span><strong>{t(p.name)}</strong><small>{t(p.tag)}</small></span>{form.provider === p.id && <Check size={15} className="ai-provider-check" />}</button>)}</div></section>
 <section className="ai-connection-card"><div className="ai-section-title"><h2><span>02</span>{t(" 连接 ")}{t(selected.name)}</h2>{selected.portal && <button className="text-button" disabled={!!busy} onClick={() => api.call('ai-portal', {
          provider: form.provider
        }).catch(e => setFeedback({
          error: true,
          text: e.message
        }))}>{t("获取 API Key ")}<ArrowUpRight size={15} /></button>}</div>
 <div className="ai-form-grid"><label className="ai-input-label"><span><KeyRound size={14} /> API Key {retained && <small>{t("已加密保存")}</small>}</span><input aria-label="API Key" type="password" autoComplete="off" spellCheck={false} disabled={!!busy} value={form.apiKey} onChange={e => edit({
            apiKey: e.target.value
          })} placeholder={retained ? t("已保存 · 留空保留现有密钥") : t("粘贴你的 API Key")} /></label><label className="ai-input-label"><span>{t("模型名称")}</span><input aria-label={t("AI 模型名称")} disabled={!!busy} spellCheck={false} value={form.model} onChange={e => edit({
            model: e.target.value
          })} placeholder={t("填写开放平台中的模型 ID")} /></label></div>
 <p className="ai-help">{t("网页会员与 API 额度独立；请使用开放平台密钥。模型名称可按账号可用模型修改。")}</p>
 <button className="ai-disclosure" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>{t("服务地址与翻译偏好 ")}<ChevronDown size={15} style={{
          transform: advanced ? 'rotate(180deg)' : ''
        }} /></button>
 {advanced && <div className="ai-advanced"><label className="ai-input-label"><span>{t("API 服务地址")}</span><input aria-label={t("AI 服务地址")} disabled={!!busy} value={form.baseUrl} onChange={e => edit({
            baseUrl: e.target.value
          })} placeholder="https://api.example.com/v1" spellCheck={false} /></label><p className="ai-help">{t("填写 Base URL，无需添加 /chat/completions。服务地址须与密钥所属平台及地区一致。更改地址后需要重新填写密钥。")}</p><div className="ai-preference"><div><strong>{t("翻译策略")}</strong><p>{t("实时优先只请求一次；精校优先再对照原文复核一次，会增加等待和 API 费用。")}</p></div><select aria-label={t("AI 翻译策略")} disabled={!!busy} value={form.quality || 'realtime'} onChange={e => edit({
            quality: e.target.value
          })}><option value="realtime">{t("实时优先")}</option><option value="precise">{t("精校优先")}</option></select></div><div className="ai-preference"><div><strong>{t("参考最近几句")}</strong><p>{t("屏幕与听译最多带入最近 3 句短上下文；停止后清空，2 分钟后过期。")}</p></div><Toggle label={t("AI 参考最近几句")} checked={form.context} disabled={!!busy} onChange={context => edit({
            context
          })} /></div></div>}
 <div className="ai-data-note"><ShieldCheck size={16} /><p>{t("Key 由 Windows 加密保存在本机。启用后，仅待译文字及开启的短上下文发送至所选服务商；录音、截图和语库不会上传。调用可能产生 API 费用。")}</p></div>
 {feedback && <div className={'ai-feedback ' + (feedback.error ? 'error' : 'success')} role={feedback.error ? 'alert' : 'status'}><strong>{t(feedback.text)}</strong>{feedback.sample && <p>{feedback.sample}</p>}</div>}
 <div className="ai-actions"><button disabled={!ready || !!busy || !desktop} onClick={() => act('test')}>{t("{0}测试连接", [busy === 'test' ? <LoaderCircle size={16} className="spin" /> : <PlugZap size={16} />])}</button><button className="primary" disabled={!ready || !!busy || !desktop} onClick={() => act('save')}>{t("{0}保存并启用", [busy === 'save' ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />])}</button><span>{t("测试按所选策略发送混合语种示例")}</span></div>
 {saved?.hasKey && <div className="ai-saved"><div><Toggle label={t("启用 AI 翻译")} checked={saved.enabled} disabled={!!busy} onChange={() => act('toggle')} /><span>{t("使用已保存的连接")}</span></div>{confirmDelete ? <div><span>{t("删除此密钥？")}</span><button disabled={!!busy} onClick={() => act('forget')}>{t("删除")}</button><button disabled={!!busy} onClick={() => setConfirmDelete(false)}>{t("取消")}</button></div> : <button className="text-button" disabled={!!busy} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />{t("删除密钥")}</button>}</div>}
 </section><section className="ai-agent-card"><div className="ai-section-title"><h2><Sparkles size={17} />{t(" 已内置翻译规则")}</h2><span>{t("自动应用 · 无需编写提示词")}</span></div><div className="ai-principles"><div><strong>{t("理解整句")}</strong><p>{t("固定短语、连接词与专业名词，结合上下文选择语义。")}</p></div><div><strong>{t("识别混合语种")}</strong><p>{t("原文直接翻到每个目标语种，不经英语中转；最多同时输出 3 种译文。")}</p></div><div><strong>{t("忠实于原意")}</strong><p>{t("保留专名、数字与语气；未知识别内容留白，不自行补写。")}</p></div></div><p className="ai-help">{t("语音和屏幕识别仍在本机完成；听译需要语音识别包。AI 无法恢复未被识别出的声音或文字，速度与质量也取决于网络和所选模型。连接失败会明确提示，可关闭 AI 使用本地翻译。")}</p></section></div>;
}
