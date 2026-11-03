'use client';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { LineChart } from '@/components/charts';
import { Banner, Empty } from '@/components/ui';
import { pct, qtyFmt, usd } from '@/lib/format';
import { drivers, swingText } from '@/lib/stats';

export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>(); const { data, state } = useApp();
  const s = useMemo(() => { try { return data.stock(decodeURIComponent(ticker)); } catch { return null; } }, [data, ticker, state]);
  if (!s) return <AppShell title="Not found" back="/home"><Empty title="We could not find that investment" text="It may have been removed. Head back to your home screen." action={<Link className="btn btn-primary" href="/home">Back to Home</Link>} /></AppShell>;
  const closes = s.points.map((p) => p.close); const hi = Math.max(...closes), lo = Math.min(...closes);
  return <AppShell title={s.ticker} back="/home">
    <section className="card"><div className="row between wrap"><span className="chip">{s.type === 'etf' ? 'Fund' : s.type === 'stock' ? 'Company' : 'Simulated coin'}</span><span className="muted">Simulated, delayed prices</span></div>
      <h2 className="h2">{s.name}</h2><div className="big">{usd(s.priceCents)}</div>
      <div className={s.dayChange >= 0 ? 'gain' : 'loss'}>{s.dayChange >= 0 ? '▲' : '▼'} {pct(Math.abs(s.dayChange), 2).replace('+', '')} last market day</div>
      <LineChart unit="dollars" label={`${s.ticker} price over one year`} points={s.points.map((p) => ({ date: p.date, v: p.close }))} /></section>
    {s.held && <section className="card"><div className="eyebrow">Your holding</div>
      <div className="row between"><span>Value</span><b>{usd(s.held.valueCents)}</b></div><div className="row between"><span>Shares</span><b>{qtyFmt(s.held.qty)}</b></div>
      <div className="row between"><span>Gain or loss</span><b className={s.held.gainCents >= 0 ? 'gain' : 'loss'}>{usd(s.held.gainCents, { sign: true })}</b></div>
      <div className="row between"><span>Share of your account</span><b>{(s.held.weight * 100).toFixed(1)}%</b></div></section>}
    {s.stats && <section className="card" aria-label="Key figures"><div className="eyebrow">Key figures, last year</div>
      <div className="list-row"><div><b>Change over the year</b><div className="muted">Where it ended compared with where it started.</div></div><b className={s.stats.changePct >= 0 ? 'gain' : 'loss'}>{s.stats.changePct >= 0 ? '▲' : '▼'} {Math.abs(s.stats.changePct).toFixed(1)}%</b></div>
      <div className="list-row"><div><b>Typical daily move</b><div className="muted">{swingText(s.stats.swing)}</div></div><b>±{s.stats.swingPct.toFixed(1)}%</b></div>
      <div className="list-row"><div><b>Worst fall from a high</b><div className="muted">The biggest drop from a peak before it recovered.</div></div><b className="loss">{s.stats.worstFallPct.toFixed(0)}%</b></div>
      <div className="list-row"><div><b>Range</b><div className="muted">Lowest and highest price.</div></div><b>{usd(Math.round(s.stats.low * 100))} to {usd(Math.round(s.stats.high * 100))}</b></div></section>}
    <section className="card"><div className="eyebrow">What drives it</div><p style={{ margin: 0 }}>{drivers(s.type)}</p>
      <Link className="btn btn-secondary" href={`/allie?ask=${encodeURIComponent(`What drives ${s.name} and how risky is it?`)}`}>Ask Allie about this</Link></section>
    <section className="card"><div className="eyebrow">About</div><p style={{ margin: 0 }}>{s.blurb}</p>
      <p className="muted" style={{ margin: 0 }}>In the last year this simulated price ranged from {usd(Math.round(lo * 100))} to {usd(Math.round(hi * 100))}. The top was {(((hi - lo) / lo) * 100).toFixed(0)}% above the bottom, which shows how far it can swing.</p></section>
    <Banner>This investment is fictional and its prices are simulated for practice. Nothing here is advice.</Banner>
  </AppShell>;
}
