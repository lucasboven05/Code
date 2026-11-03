'use client';
import { useState } from 'react';
import { Banner, Button, TextField } from './ui';
import { PlainPage } from './Shell';
import { getSupabase } from '@/lib/supabase';

export function SignIn() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); const v = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setErr('Enter a valid email address.');
    setErr(null); setBusy(true);
    const { error } = await (await getSupabase()).auth.signInWithOtp({ email: v, options: { emailRedirectTo: window.location.origin } }); setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }
  return <PlainPage>
    <div className="eyebrow">Practice Invest</div><h1 className="big">Sign in</h1>
    <p className="muted" style={{ margin: 0 }}>We will email you a one-time link. No password to remember.</p>
    {sent ? <Banner kind="success">Check your inbox for the link, then open it on this device. You can close this tab.</Banner> : <form className="grid gap-3" onSubmit={go} noValidate>
      <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} error={err} />
      <Button size="lg" type="submit" loading={busy}>Email me a link</Button></form>}
    <Banner>This is a private practice app. Everything in it is simulated.</Banner>
  </PlainPage>;
}
