'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { Button, ChoiceGroup, TextField } from '@/components/ui';
import { PlainPage } from '@/components/Shell';
import { useLatch } from '@/lib/useLatch';

const GOALS = ['A first home', 'Retirement', 'A big trip or purchase', 'A safety cushion', 'Just learning'].map((g) => ({ value: g, label: g }));
const HORIZON = [{ value: 1, label: 'Under 2 years' }, { value: 4, label: '2 to 5 years' }, { value: 8, label: '5 to 10 years' }, { value: 15, label: '10 years or more' }];
const RISK = [
  { value: 1, label: 'I would be upset by any drop', hint: 'Slow and steady matters most.' },
  { value: 2, label: 'A small dip is okay', hint: 'I want mostly calm investments.' },
  { value: 3, label: 'I can sit through a moderate dip', hint: 'A balance of calm and growth.' },
  { value: 4, label: 'I can handle big drops for more growth', hint: 'I have time to wait things out.' },
  { value: 5, label: 'Big swings do not bother me', hint: 'Growth first.' },
];
const N = 5;

export default function Questionnaire() {
  const { state, data, act, ready } = useApp(); const router = useRouter(); const p = state.profile;
  const [step, setStep] = useState(0); const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]); const [horizon, setHorizon] = useState<number | null>(null); const [risk, setRisk] = useState<number | null>(null);
  const once = useLatch(); const [year, setYear] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && p.onboardedAt) router.replace('/home'); }, [ready, p.onboardedAt, router]);
  useEffect(() => { if (!ready) return; setStep(Math.min(p.step, N - 1)); setGoals(p.goals); setHorizon(p.horizonYears); setRisk(p.riskTolerance); setYear(p.birthYear ? String(p.birthYear) : ''); setName(p.displayName); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const titles = ['What are you saving for?', 'When might you need this money?', 'How do you feel about ups and downs?', 'What year were you born?', 'What should we call you?'];
  const next = () => once(nextStep);
  async function nextStep() {
    setError(null);
    let patch: Parameters<typeof data.saveProfile>[0] = {};
    if (step === 0) { if (!goals.length) return setError('Pick at least one goal.'); patch = { goals }; }
    if (step === 1) { if (horizon == null) return setError('Pick a time frame.'); patch = { horizonYears: horizon }; }
    if (step === 2) { if (risk == null) return setError('Pick the answer closest to you.'); patch = { riskTolerance: risk }; }
    if (step === 3) { if (year.trim()) { const y = Number(year); if (!Number.isInteger(y) || y < 1930 || y > new Date().getFullYear() - 18) return setError('Enter a four-digit year, 18 or older, or leave it blank.'); patch = { birthYear: y }; } else patch = { birthYear: null }; }
    if (step === 4) patch = { displayName: name.trim().slice(0, 40) };
    setBusy(true); const last = step === N - 1;
    const r = await act(data.saveProfile({ ...patch, step: last ? N : step + 1 })); setBusy(false);
    if (!r) return; if (last) router.push('/onboarding/portfolio'); else setStep(step + 1);
  }
  return <PlainPage back={step > 0 ? undefined : '/welcome'}>
    <div className="grid gap-2"><div className="muted" aria-live="polite">Step {step + 1} of {N}</div><div className="bar" role="progressbar" aria-label="Setup progress" aria-valuetext={`Step ${step + 1} of ${N}`} aria-valuemin={1} aria-valuemax={N} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / N) * 100}%` }} /></div></div>
    <h1 className="h1">{titles[step]}</h1>
    {step === 0 && <ChoiceGroup multi label="Goals" options={GOALS} value={goals} onChange={setGoals} />}
    {step === 1 && <ChoiceGroup label="Time frame" options={HORIZON} value={horizon} onChange={setHorizon} />}
    {step === 2 && <ChoiceGroup label="Comfort with ups and downs" options={RISK} value={risk} onChange={setRisk} />}
    {step === 3 && <TextField label="Birth year (optional)" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} hint="Only used to pick a sample mix. Leave blank to skip." error={error} maxLength={4} />}
    {step === 4 && <TextField label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />}
    {error && step !== 3 && <p className="errmsg" role="alert" style={{ margin: 0 }}>⚠ {error}</p>}
    <div className="row">
      {step > 0 && <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Back</Button>}
      <Button className="flex-1" loading={busy} onClick={next}>{step === N - 1 ? 'See my sample mix' : 'Continue'}</Button>
    </div>
  </PlainPage>;
}
