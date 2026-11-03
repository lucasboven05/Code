'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { LineChart } from '@/components/charts';
import { AmountField, Banner, Button, Empty, Segmented, Sheet } from '@/components/ui';
import { dateFmt, parseMoney, pct, usd } from '@/lib/format';
import { INSTRUMENTS } from '@/lib/seed';
import { useLatch } from '@/lib/useLatch';

type R = '1W' | '1M' | '3M' | '1Y' | 'All';
export default function Home() {
  const { state, data, act } = useApp(); const [range, setRange] = useState<R>('3M'); const [sheet, setSheet] = useState<null | 'add' | 'amount'>(null);
  const once = useLatch(); const [amt, setAmt] = useState(''); const [err, setErr] = useState<string | null>(null);
  const v = useMemo(() => (state.profile.onboardedAt ? data.home() : null), [state, data]);
  const series = useMemo(() => (state.profile.onboardedAt ? data.series(range) : []), [state, data, range]);
  if (!v) return <AppShell title="Home"><div /></AppShell>;
  const c = v.contributions.find((x) => x.status !== 'cancelled'); const gain = v.valueCents - v.netDepositsCents;
  const submit = () => once(submitNow);
  async function submitNow() {
    const m = parseMoney(amt); if (!m.ok) return setErr(m.error); const cents = m.cents; setErr(null);
    const r = sheet === 'add' ? await act(data.addMoney(cents), 'Added practice cash.') : c ? await act(data.updateContribution(c.id, { amountCents: cents }), 'Plan updated.') : null;
    if (r) { setSheet(null); setAmt(''); }
  }
  return <AppShell title="Home" action={<Link href="/activity" className="btn btn-ghost btn-sm">Activity</Link>}>
    <section className="card">
      <div className="eyebrow">Practice account</div>
      <div className="big" aria-label={`Total value ${usd(v.valueCents)}`}>{usd(v.valueCents)}</div>
      <div className="row wrap"><span className={v.dayChangeCents >= 0 ? 'gain' : 'loss'}>{v.dayChangeCents >= 0 ? '▲' : '▼'} {usd(Math.abs(v.dayChangeCents))} last market day</span>
        <span className="muted">· {usd(gain, { sign: true })} overall</span></div>
      <LineChart label="Practice account value" points={series.map((p) => ({ date: p.date, v: p.valueCents }))} />
      <Segmented label="Chart range" value={range} onChange={setRange} options={(['1W', '1M', '3M', '1Y', 'All'] as R[]).map((x) => ({ value: x, label: x }))} />
      <p className="muted" style={{ margin: 0 }}>Simulated prices as of {dateFmt(v.today)}. Cash: {usd(v.cashCents)}.</p>
    </section>

    {c && <section className="card"><div className="eyebrow">Your plan</div>
      <div className="row between"><div><b>{v.plan?.name ?? 'Sample'} mix</b><div className="muted">{usd(c.amountCents)} {c.frequency === 'once' ? 'once' : c.frequency === 'monthly' ? 'monthly' : c.frequency === 'weekly' ? 'weekly' : 'every 2 weeks'} · {c.status === 'active' && c.nextRunOn ? 'next ' + dateFmt(c.nextRunOn) : c.status === 'done' ? 'finished' : 'paused'}</div></div></div>
      <div className="row wrap">
        {c.status !== 'done' && <Button variant="secondary" size="sm" onClick={() => act(data.updateContribution(c.id, { status: c.status === 'active' ? 'paused' : 'active' }), c.status === 'active' ? 'Plan paused.' : 'Plan resumed.')}>{c.status === 'active' ? 'Pause' : 'Resume'}</Button>}
        <Button variant="secondary" size="sm" onClick={() => { setAmt((c.amountCents / 100).toString()); setSheet('amount'); }}>Change amount</Button>
        <Button variant="secondary" size="sm" onClick={() => { setAmt(''); setSheet('add'); }}>Add practice cash</Button></div></section>}

    <section className="card"><div className="row between"><div className="eyebrow">Holdings</div><Link href="/briefing" className="btn btn-ghost btn-sm">Daily briefing</Link></div>
      {v.rows.length === 0 ? <Empty title="Nothing invested yet" text="Your first scheduled purchase will appear here. You can also add practice cash or invest in a playlist." action={<Link href="/playlists" className="btn btn-primary">Browse playlists</Link>} /> :
        v.rows.map((r) => <Link key={r.ticker} href={`/stock/${r.ticker}`} className="list-row"><div><b>{r.ticker}</b><div className="muted">{r.name}</div></div>
          <div style={{ textAlign: 'right' }}><b>{usd(r.valueCents)}</b><div className={r.dayChange >= 0 ? 'gain' : 'loss'}>{r.dayChange >= 0 ? '▲' : '▼'} {pct(Math.abs(r.dayChange)).replace('+', '')}</div></div></Link>)}
    </section>
    {state.holdings.some((h) => INSTRUMENTS.find((i) => i.ticker === h.ticker)?.type === 'crypto') && <Banner>You hold simulated coins. They swing a lot more than funds.</Banner>}

    {sheet && <Sheet title={sheet === 'add' ? 'Add practice cash' : 'Change plan amount'} onClose={() => { setSheet(null); setErr(null); }}>
      <AmountField label="Amount" value={amt} onChange={(x) => { setAmt(x); setErr(null); }} error={err} />
      <Button size="lg" onClick={submit}>{sheet === 'add' ? 'Add cash' : 'Save'}</Button></Sheet>}
  </AppShell>;
}
