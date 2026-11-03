'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Banner, Button, Skeleton, TextField } from '@/components/ui';
import { INSTRUMENTS } from '@/lib/seed';

type Row = { ticker: string; pct: string };
function Builder() {
  const { state, data, act, ready } = useApp(); const router = useRouter(); const editId = useSearchParams().get('edit');
  const [name, setName] = useState(''); const [theme, setTheme] = useState(''); const [desc, setDesc] = useState(''); const [rows, setRows] = useState<Row[]>([]); const [q, setQ] = useState(''); const [errs, setErrs] = useState<{ name?: string }>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!ready || !editId) return; const p = state.playlists.find((x) => x.id === editId && x.owner === 'me'); if (p) { setName(p.name); setTheme(p.theme); setDesc(p.description); setRows(p.items.map((i) => ({ ticker: i.ticker, pct: String(i.weightBps / 100) }))); } }, [ready, editId]); // eslint-disable-line react-hooks/exhaustive-deps
  const bps = (r: Row) => { const v = Number(r.pct.trim().replace(',', '.')); return r.pct.trim() !== '' && Number.isFinite(v) ? Math.round(v * 100) : NaN; };
  const badRow = rows.some((r) => { const w = bps(r); return !(w > 0 && w <= 10000); });
  const total = rows.reduce((t, r) => t + (bps(r) > 0 ? bps(r) : 0), 0);
  const matches = useMemo(() => INSTRUMENTS.filter((i) => !rows.some((r) => r.ticker === i.ticker) && (i.ticker + ' ' + i.name).toLowerCase().includes(q.toLowerCase())).slice(0, 6), [q, rows]);
  const evenly = () => { const n = rows.length; if (!n) return; const base = Math.floor(10000 / n); setRows(rows.map((r, i) => ({ ...r, pct: String((base + (i === 0 ? 10000 - base * n : 0)) / 100) }))); };
  async function save() {
    if (!name.trim()) return setErrs({ name: 'Give your playlist a name.' }); setErrs({}); setBusy(true);
    const items = rows.map((r) => ({ ticker: r.ticker, weightBps: bps(r) }));
    const body = { name, theme: theme.trim(), description: desc.trim(), isPublic: false, items };
    const r = await act(editId ? data.updatePlaylist(editId, body) : data.createPlaylist(body), 'Playlist saved.'); setBusy(false); if (r) router.push('/playlists');
  }
  if (!ready) return <Skeleton lines={5} />;
  return <>
    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={errs.name} />
    <TextField label="Theme (optional)" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={30} placeholder="Energy, health, income…" />
    <TextField label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={140} />
    <section className="card"><div className="eyebrow">Add investments</div><TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or ticker" />
      {matches.length === 0 ? <p className="muted" style={{ margin: 0 }}>No matches.</p> : matches.map((i) => <div key={i.ticker} className="list-row"><div><b>{i.ticker}</b><div className="muted">{i.name}</div></div><Button size="sm" variant="secondary" aria-label={`Add ${i.ticker}`} onClick={() => { setRows([...rows, { ticker: i.ticker, pct: '' }]); setQ(''); }}>Add</Button></div>)}</section>
    <section className="card"><div className="row between"><div className="eyebrow">Weights</div><Button size="sm" variant="ghost" onClick={evenly} disabled={!rows.length}>Spread evenly</Button></div>
      {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>Add at least one investment above.</p> : rows.map((r, k) => <div key={r.ticker} className="row"><b style={{ flex: 1 }}>{r.ticker}</b>
        <input className="input" style={{ width: 88, textAlign: 'right' }} inputMode="decimal" aria-label={`${r.ticker} weight percent`} value={r.pct} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, pct: e.target.value } : x)))} /><span aria-hidden>%</span>
        <Button size="sm" variant="secondary" aria-label={`Remove ${r.ticker}`} onClick={() => setRows(rows.filter((_, j) => j !== k))}>✕</Button></div>)}
      {rows.length > 0 && (badRow ? <Banner kind="error">Give every investment a weight between 0.01% and 100%, or remove it.</Banner> : total === 10000 ? <Banner kind="success">Weights total 100%.</Banner> : <Banner kind="error">Weights add up to {(total / 100).toFixed(total % 100 ? 1 : 0)}%. They need to total 100%.</Banner>)}</section>
    <Button size="lg" loading={busy} disabled={rows.length === 0 || badRow || total !== 10000} onClick={save}>{editId ? 'Save changes' : 'Save playlist'}</Button>
  </>;
}
export default function New() { return <AppShell title="Build a playlist" back="/playlists"><Suspense fallback={<Skeleton lines={5} />}><Builder /></Suspense></AppShell>; }
