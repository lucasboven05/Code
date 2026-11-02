'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Button, Field, TextField } from '@/components/ui';

const ZONES = ['America/Panama', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/Bogota', 'Europe/London', 'Europe/Madrid', 'UTC'];
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return <label className="list-row" style={{ cursor: 'pointer' }}><span>{label}</span><input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 24, height: 24 }} /></label>;
}
export default function Settings() {
  const { state, data, act } = useApp(); const router = useRouter(); const [name, setName] = useState(state.profile.displayName); const [arm, setArm] = useState<null | 'reset' | 'delete'>(null);
  const zones = ZONES.includes(state.profile.timezone) ? ZONES : [state.profile.timezone, ...ZONES];
  return <AppShell title="Settings" back="/home">
    <section className="card"><div className="eyebrow">Profile</div>
      <TextField label="Name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name !== state.profile.displayName && act(data.saveProfile({ displayName: name.trim() }), 'Saved.')} />
      <Field label="Time zone" hint="Decides what 'today' means for your schedule.">{(a) => <select {...a} className="input" value={state.profile.timezone} onChange={(e) => act(data.setTimezone(e.target.value), 'Time zone updated.')}>{zones.map((z) => <option key={z}>{z}</option>)}</select>}</Field></section>
    <section className="card"><div className="eyebrow">Investing</div><Toggle label="Rebalance automatically" on={state.account.rebalanceEnabled} onChange={(v) => act(data.setRebalance(v))} />
      <p className="muted" style={{ margin: 0 }}>Each week, if a holding drifts more than 3 points from its target, the app sells a little of what grew and buys what lagged.</p></section>
    <section className="card"><div className="eyebrow">Notifications (in the app)</div>
      <Toggle label="Daily briefing" on={state.prefs.dailyBriefing} onChange={(v) => act(data.setPrefs({ dailyBriefing: v }))} />
      <Toggle label="Contribution made" on={state.prefs.contributionDone} onChange={(v) => act(data.setPrefs({ contributionDone: v }))} />
      <Toggle label="Rebalance done" on={state.prefs.rebalanceDone} onChange={(v) => act(data.setPrefs({ rebalanceDone: v }))} /></section>
    <section className="card"><div className="eyebrow">Membership</div><div className="row between"><b>Private plan</b><span className="chip">Free</span></div><p className="muted" style={{ margin: 0 }}>No payment is taken. This is a personal practice app.</p></section>
    <section className="card"><div className="eyebrow">Your data</div>
      <Button variant={arm === 'reset' ? 'danger' : 'secondary'} onClick={async () => { if (arm !== 'reset') return setArm('reset'); const r = await act(data.resetAccount(), 'Practice account reset.'); if (r) router.push('/onboarding'); }}>{arm === 'reset' ? 'Tap again: erase my practice account' : 'Reset practice account'}</Button>
      <Button variant={arm === 'delete' ? 'danger' : 'secondary'} onClick={async () => { if (arm !== 'delete') return setArm('delete'); const r = await act(data.deleteEverything(), 'Everything erased.'); if (r) router.push('/welcome'); }}>{arm === 'delete' ? 'Tap again: delete everything' : 'Delete all my data'}</Button>
      <Link className="btn btn-ghost" href="/legal">About and disclosures</Link></section>
  </AppShell>;
}
