'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Banner, Empty } from '@/components/ui';
import { dateFmt, pct, usd } from '@/lib/format';

export default function Briefing() {
  const { state, data } = useApp(); const v = useMemo(() => (state.profile.onboardedAt ? data.home() : null), [state, data]);
  const movers = v ? [...v.rows].sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange)) : [];
  return <AppShell title="Daily briefing" back="/home">
    <Banner>These notes are built from your practice holdings and simulated prices. They are not news and not advice.</Banner>
    {!v || v.rows.length === 0 ? <Empty title="Nothing to brief you on yet" text="Once you hold something, you will see how each holding moved on the last market day." /> : <>
      <section className="card"><div className="eyebrow">{dateFmt(v.today)}</div><p style={{ margin: 0 }}>Your practice account {v.dayChangeCents >= 0 ? 'rose' : 'fell'} <b className={v.dayChangeCents >= 0 ? 'gain' : 'loss'}>{usd(Math.abs(v.dayChangeCents))}</b> on the last market day and is now worth {usd(v.valueCents)}.</p></section>
      <section className="card"><div className="eyebrow">Biggest moves</div>{movers.slice(0, 6).map((r) => <Link key={r.ticker} href={`/stock/${r.ticker}`} className="list-row"><div><b>{r.name} {r.dayChange >= 0 ? 'rose' : 'fell'} {pct(Math.abs(r.dayChange), 2).replace('+', '')}</b><div className="muted">{r.ticker} · {r.weight >= 0.3 ? 'a large part of your account' : `${(r.weight * 100).toFixed(0)}% of your account`} · Practice app, simulated prices</div></div></Link>)}</section></>}
  </AppShell>;
}
