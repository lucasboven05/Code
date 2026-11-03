'use client';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Banner } from '@/components/ui';
import { INSTRUMENTS } from '@/lib/seed';
import { pct, usd } from '@/lib/format';

export default function Crypto() {
  const { data, state } = useApp();
  const rows = state.profile.onboardedAt ? INSTRUMENTS.filter((i) => i.type === 'crypto').map((i) => data.stock(i.ticker)) : [];
  return <AppShell title="Simulated coins" back="/playlists">
    <Banner>Pretend coins with made-up prices that swing hard. Real digital coins can lose most of their value quickly.</Banner>
    <section className="card">{rows.map((s) => <Link key={s.ticker} className="list-row" href={`/stock/${s.ticker}`}><div><b>{s.ticker}</b><div className="muted">{s.name}</div></div><div style={{ textAlign: 'right' }}><b>{usd(s.priceCents)}</b><div className={s.dayChange >= 0 ? 'gain' : 'loss'}>{pct(s.dayChange, 2)}</div></div></Link>)}</section>
    <p className="muted" style={{ margin: 0 }}>To try them, invest in the Crypto curious playlist.</p>
  </AppShell>;
}
