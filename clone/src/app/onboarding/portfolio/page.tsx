'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { Disclaimer, LinkButton, Skeleton } from '@/components/ui';
import { Donut } from '@/components/charts';
import { PlainPage } from '@/components/Shell';
import { INSTRUMENTS } from '@/lib/seed';

const LABEL = ['', 'very calm', 'calm', 'balanced', 'growth-minded', 'growth-first'];
export default function Matched() {
  const { state, data, ready } = useApp(); const router = useRouter();
  useEffect(() => { if (ready && state.profile.riskTolerance == null) router.replace('/onboarding'); }, [ready, state.profile.riskTolerance, router]);
  if (!ready || state.profile.riskTolerance == null) return <PlainPage><Skeleton lines={5} /></PlainPage>;
  const m = data.matchedPortfolio(); const p = state.profile;
  return <PlainPage back="/onboarding">
    <div className="eyebrow">Your sample mix</div>
    <h1 className="h1">{p.displayName ? `${p.displayName}, here is ` : 'Here is '}the {m.name} mix.</h1>
    <p className="muted" style={{ margin: 0 }}>{m.description} It looks {LABEL[m.riskLevel]} (level {m.riskLevel} of 5) based on your answers{p.horizonYears ? ` and a ${p.horizonYears <= 2 ? 'short' : p.horizonYears <= 5 ? 'medium' : 'long'} time frame` : ''}.</p>
    <section className="card" aria-label="What is inside">
      <Donut label={`${m.name} mix`} slices={m.allocations.map((a) => ({ name: INSTRUMENTS.find((i) => i.ticker === a.ticker)?.name ?? a.ticker, weight: a.weightBps }))} />
    </section>
    <Disclaimer>This is one of five fictional sample portfolios for learning. It is not advice, and the funds are made up.</Disclaimer>
    <LinkButton href="/onboarding/fund" size="lg">Continue</LinkButton>
  </PlainPage>;
}
