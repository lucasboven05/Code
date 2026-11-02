'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Banner, Button, Empty } from '@/components/ui';
import { DISCLAIMER, SUGGESTIONS } from '@/lib/allie';

export default function Allie() {
  const { state, data, act } = useApp(); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [state.chat.length]);
  async function send(t: string) { if (!t.trim() || busy) return; setBusy(true); const r = await act(data.sendChat(t)); setBusy(false); if (r) setText(''); }
  return <AppShell title="Allie" action={<Button size="sm" variant="secondary" onClick={() => act(data.addRecap())}>My recap</Button>}>
    <Banner>{DISCLAIMER}</Banner>
    <div className="flex flex-col gap-2" role="log" aria-live="polite" aria-label="Conversation with Allie">
      {state.chat.length === 0 ? <Empty title="Ask Allie anything about investing" text="Try a question about funds, risk, rebalancing or compounding, or ask for a recap of your account." /> :
        state.chat.map((m) => <div key={m.id} className={`bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>{m.kind === 'recap' && <div className="eyebrow" style={{ marginBottom: 4 }}>Recap</div>}{m.content}</div>)}
      <div ref={end} />
    </div>
    <div className="row wrap">{SUGGESTIONS.map((s) => <button key={s} className="pill-btn" disabled={busy} onClick={() => send(s)}>{s}</button>)}</div>
    <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
      <input className="input" aria-label="Ask Allie" placeholder="Ask a question" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} disabled={busy} /><Button type="submit" disabled={busy || !text.trim()}>Send</Button></form>
  </AppShell>;
}
