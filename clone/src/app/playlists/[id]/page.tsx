'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Donut, LineChart } from '@/components/charts';
import { AmountField, Banner, Button, Empty, Sheet } from '@/components/ui';
import { INSTRUMENTS } from '@/lib/seed';
import { priceAt } from '@/lib/prices';
import { addDays, isTradingDay, prevTradingDay } from '@/lib/calendar';
import { toCents } from '@/lib/format';

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>(); const { state, data, act } = useApp(); const router = useRouter();
  const [open, setOpen] = useState(false); const [amt, setAmt] = useState('25'); const [err, setErr] = useState<string | null>(null); const [armed, setArmed] = useState(false); const [busy, setBusy] = useState(false);
  const p = state.playlists.find((x) => x.id === id);
  const points = useMemo(() => {
    if (!p) return []; const end = prevTradingDay(data.today()); const start = prevTradingDay(addDays(end, -91)); const out: { date: string; v: number }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) if (isTradingDay(d)) out.push({ date: d, v: p.items.reduce((t, i) => t + (i.weightBps / 10000) * (priceAt(i.ticker, d) / priceAt(i.ticker, start)) * 100, 0) });
    return out;
  }, [p, data]);
  if (!p) return <AppShell title="Not found" back="/playlists"><Empty title="That playlist is gone" text="It may have been deleted." action={<Link className="btn btn-primary" href="/playlists">All playlists</Link>} /></AppShell>;
  async function invest() {
    const c = toCents(amt); if (c == null) return setErr('Enter an amount above zero.'); setErr(null); setBusy(true);
    const r = await act(data.investInPlaylist(p!.id, c), 'Invested in ' + p!.name + '.'); setBusy(false); if (r) { setOpen(false); router.push('/home'); }
  }
  return <AppShell title={p.name} back="/playlists">
    <section className="card"><span className="chip" style={{ alignSelf: 'flex-start' }}>{p.theme || 'Custom'}</span><p style={{ margin: 0 }}>{p.description || 'Your own mix.'}</p>
      <Donut label={`${p.name} weights`} slices={p.items.map((i) => ({ name: INSTRUMENTS.find((x) => x.ticker === i.ticker)?.name ?? i.ticker, weight: i.weightBps }))} />
      <Button size="lg" onClick={() => setOpen(true)}>Invest in this playlist</Button></section>
    <section className="card"><div className="eyebrow">Last 3 months, if you had held this mix (starts at 100)</div><LineChart unit="index" label={`${p.name} simulated performance`} points={points} /></section>
    <section className="card"><div className="eyebrow">Inside</div>{p.items.map((i) => <Link key={i.ticker} className="list-row" href={`/stock/${i.ticker}`}><div><b>{i.ticker}</b><div className="muted">{INSTRUMENTS.find((x) => x.ticker === i.ticker)?.name}</div></div><b>{(i.weightBps / 100).toFixed(i.weightBps % 100 ? 1 : 0)}%</b></Link>)}</section>
    {p.owner === 'me' && <div className="row wrap"><Link className="btn btn-secondary" href={`/playlists/new?edit=${p.id}`}>Edit</Link>
      <Button variant={armed ? 'danger' : 'secondary'} onClick={() => { if (!armed) return setArmed(true); act(data.deletePlaylist(p.id), 'Playlist deleted.').then(() => router.push('/playlists')); }}>{armed ? 'Tap again to delete' : 'Delete'}</Button></div>}
    <Banner>Simulated performance on fictional prices. It shows how a mix behaves, not what will happen.</Banner>
    {open && <Sheet title={`Invest in ${p.name}`} onClose={() => setOpen(false)}><AmountField label="Amount" value={amt} onChange={(v) => { setAmt(v); setErr(null); }} error={err} /><p className="muted" style={{ margin: 0 }}>Practice money is added and spread across the weights above, at the last market day's price.</p><Button size="lg" loading={busy} onClick={invest}>Invest</Button></Sheet>}
  </AppShell>;
}
