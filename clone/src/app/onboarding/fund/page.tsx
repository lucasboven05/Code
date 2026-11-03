'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { Banner, Button, Field, Segmented, Skeleton, AmountField } from '@/components/ui';
import { PlainPage } from '@/components/Shell';
import { toCents, usd } from '@/lib/format';
import type { Frequency } from '@/lib/types';
import type { PracticeStart } from '@/lib/data';
import { useLatch } from '@/lib/useLatch';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function Fund() {
  const { state, data, act, ready } = useApp(); const router = useRouter();
  const [amount, setAmount] = useState('50'); const [freq, setFreq] = useState<Frequency>('monthly'); const [dow, setDow] = useState(1); const [dom, setDom] = useState(1);
  const once = useLatch(); const [start, setStart] = useState<PracticeStart>('6m'); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (ready && state.profile.onboardedAt) router.replace('/home'); else if (ready && state.profile.riskTolerance == null) router.replace('/onboarding'); }, [ready, state.profile.riskTolerance, state.profile.onboardedAt, router]);
  if (!ready) return <PlainPage><Skeleton lines={5} /></PlainPage>;
  const m = data.matchedPortfolio();
  const go = () => once(submit);
  async function submit() {
    const c = toCents(amount); if (c == null || c < 100) return setErr('Enter an amount of at least $1.00.'); if (c > 10_000_000) return setErr('Practice amounts are capped at $100,000.');
    setErr(null); setBusy(true);
    const r = await act(data.completeOnboarding({ amountCents: c, frequency: freq, dayOfWeek: freq === 'weekly' || freq === 'biweekly' ? dow : null, dayOfMonth: freq === 'monthly' ? dom : null, start })); setBusy(false);
    if (r) router.push('/home');
  }
  const c = toCents(amount);
  return <PlainPage back="/onboarding/portfolio" title="Set up investing">
    <AmountField label="How much each time?" value={amount} onChange={(v) => { setAmount(v); setErr(null); }} error={err} />
    <Field label="How often?">{() => <Segmented label="How often" value={freq} onChange={setFreq} options={[{ value: 'once', label: 'Once' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 wks' }, { value: 'monthly', label: 'Monthly' }]} />}</Field>
    {(freq === 'weekly' || freq === 'biweekly') && <Field label="Which day?">{(a) => <select {...a} className="input" value={dow} onChange={(e) => setDow(+e.target.value)}>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}</select>}</Field>}
    {freq === 'monthly' && <Field label="Which day of the month?" hint="Days 1 to 28 so every month has one.">{(a) => <select {...a} className="input" value={dom} onChange={(e) => setDom(+e.target.value)}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>}</Field>}
    <Field label="When should practice begin?" hint="Pick an earlier start to replay your plan on past prices and see how it would have gone.">{() => <Segmented label="Practice start" value={start} onChange={setStart} options={[{ value: 'today', label: 'Today' }, { value: '6m', label: '6 months ago' }, { value: '1y', label: '1 year ago' }]} />}</Field>
    <div className="card"><div className="eyebrow">Summary</div><p style={{ margin: 0 }}>{c ? usd(c) : 'An amount'} {freq === 'once' ? 'once' : freq === 'monthly' ? `on day ${dom} of each month` : `${freq === 'weekly' ? 'every week' : 'every two weeks'} on ${DAYS[dow]}`}, invested in the {m.name} mix.</p>
      <p className="muted" style={{ margin: 0 }}>Buys happen on market days at that day's simulated price. Parts of a share are fine, and leftover cents stay as cash.</p></div>
    <Banner>Practice money and made-up sample funds, so nothing real is bought.</Banner>
    <Button size="lg" loading={busy} onClick={go}>Start investing</Button>
  </PlainPage>;
}
