'use client';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { LineChart } from '@/components/charts';
import { AmountField, Banner, Button, Empty, Sheet, TextField } from '@/components/ui';
import { monthlyNeeded, projectionSeries } from '@/lib/engine';
import { toCents, usd } from '@/lib/format';
import type { Goal } from '@/lib/types';

const monthly = (s: ReturnType<typeof useApp>['state']) => s.contributions.filter((c) => c.status === 'active').reduce((t, c) => t + (c.frequency === 'monthly' ? c.amountCents : c.frequency === 'weekly' ? (c.amountCents * 52) / 12 : c.frequency === 'biweekly' ? (c.amountCents * 26) / 12 : 0), 0);
export default function Goals() {
  const { state, data, act } = useApp(); const year = new Date().getFullYear();
  const [rate, setRate] = useState(5); const [edit, setEdit] = useState<Partial<Goal> | null>(null); const [amt, setAmt] = useState(''); const [errs, setErrs] = useState<{ name?: string; amt?: string; year?: string }>({});
  const home = useMemo(() => (state.profile.onboardedAt ? data.home() : null), [state, data]); const start = home?.valueCents ?? 0; const perMonth = Math.round(monthly(state));
  async function save() {
    const c = toCents(amt); const y = Number(edit?.targetYear); const e: typeof errs = {};
    if (!edit?.name?.trim()) e.name = 'Give your goal a name.'; if (c == null) e.amt = 'Enter an amount above zero.'; if (!Number.isInteger(y) || y <= year || y > year + 60) e.year = `Pick a year between ${year + 1} and ${year + 60}.`;
    setErrs(e); if (Object.keys(e).length) return;
    const r = await act(data.saveGoal({ id: edit?.id, name: edit!.name!, targetCents: c!, targetYear: y }), 'Goal saved.'); if (r) setEdit(null);
  }
  return <AppShell title="Goals" action={<Button size="sm" onClick={() => { setEdit({ targetYear: year + 10 }); setAmt(''); setErrs({}); }}>Add goal</Button>}>
    <Banner>These are hypothetical estimates using a growth rate you choose. They are not predictions or promises.</Banner>
    <section className="card"><label htmlFor="rate" className="row between"><span className="eyebrow">Assumed yearly growth</span><b>{rate}%</b></label>
      <input id="rate" type="range" min={0} max={10} step={0.5} value={rate} onChange={(e) => setRate(+e.target.value)} aria-valuetext={`${rate} percent per year`} />
      <p className="muted" style={{ margin: 0 }}>Starting from {usd(start)} now and adding about {usd(perMonth)} a month from your plan. Try 3% for a gloomy case and 7% for a sunny one.</p></section>
    {state.goals.length === 0 ? <Empty title="No goals yet" text="Add a goal with an amount and a year to see a hypothetical path to it." action={<Button onClick={() => { setEdit({ targetYear: year + 10 }); setAmt(''); setErrs({}); }}>Add a goal</Button>} /> :
      state.goals.map((g) => { const yrs = g.targetYear - year; const proj = projectionSeries(start, perMonth, yrs, rate / 100); const end = proj[proj.length - 1]; const need = monthlyNeeded(g.targetCents, start, yrs, rate / 100);
        return <section key={g.id} className="card"><div className="row between"><div className="h2">{g.name}</div><span className="muted">{usd(g.targetCents)} by {g.targetYear}</span></div>
          <LineChart label={`Hypothetical path to ${g.name}`} points={proj.map((v, i) => ({ date: `${year + i}-01-01`, v: Math.round(v) }))} />
          <p style={{ margin: 0 }}>At {rate}% a year you would have about <b>{usd(Math.round(end))}</b> by {g.targetYear}. {end >= g.targetCents ? 'That reaches the goal in this scenario.' : <>Reaching it would take about <b>{usd(need)}</b> a month in this scenario.</>}</p>
          <div className="row"><Button size="sm" variant="secondary" onClick={() => { setEdit(g); setAmt(String(g.targetCents / 100)); setErrs({}); }}>Edit</Button><Button size="sm" variant="ghost" onClick={() => act(data.deleteGoal(g.id), 'Goal deleted.')}>Delete</Button></div></section>; })}
    {edit && <Sheet title={edit.id ? 'Edit goal' : 'New goal'} onClose={() => setEdit(null)}>
      <TextField label="Name" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={40} error={errs.name} />
      <AmountField label="Target amount" value={amt} onChange={setAmt} error={errs.amt} />
      <TextField label="Target year" inputMode="numeric" value={String(edit.targetYear ?? '')} onChange={(e) => setEdit({ ...edit, targetYear: Number(e.target.value.replace(/\D/g, '')) })} error={errs.year} maxLength={4} />
      <Button size="lg" onClick={save}>Save goal</Button></Sheet>}
  </AppShell>;
}
