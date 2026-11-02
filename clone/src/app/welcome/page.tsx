'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { LinkButton, Disclaimer } from '@/components/ui';
import { PlainPage } from '@/components/Shell';

const POINTS = [
  ['Answer a few questions', 'Tell us what you are saving for and how bumpy a ride you can stomach.'],
  ['Get a sample mix', 'We match you to one of five sample portfolios and show what is inside.'],
  ['Invest on autopilot', 'Pick an amount and a day. The app buys for you on schedule, with practice money.'],
  ['Ask Allie anything', 'A learning assistant explains funds, risk and rebalancing in plain words.'],
];
export default function Welcome() {
  const { ready, state } = useApp(); const router = useRouter();
  useEffect(() => { if (ready && state.profile.onboardedAt) router.replace('/home'); }, [ready, state.profile.onboardedAt, router]);
  const started = state.profile.step > 0;
  return <PlainPage>
    <div className="eyebrow">Practice Invest</div>
    <h1 className="big">Learn to invest without risking a cent.</h1>
    <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-md)' }}>A private practice app. Everything runs on pretend money and fictional sample investments, so you can try plans, watch them grow or shrink, and learn how it all works.</p>
    <ul className="card" style={{ listStyle: 'none', margin: 0 }}>
      {POINTS.map(([t, d]) => <li key={t} className="list-row" style={{ alignItems: 'flex-start' }}><div><b>{t}</b><div className="muted">{d}</div></div></li>)}
    </ul>
    <LinkButton href="/onboarding" size="lg">{started ? 'Continue setup' : 'Get started'}</LinkButton>
    <Disclaimer />
  </PlainPage>;
}
