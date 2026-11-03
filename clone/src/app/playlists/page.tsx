'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Empty, Segmented, TextField } from '@/components/ui';

export default function Playlists() {
  const { state } = useApp(); const [tab, setTab] = useState<'all' | 'mine'>('all'); const [q, setQ] = useState('');
  const list = useMemo(() => state.playlists.filter((p) => (tab === 'mine' ? p.owner === 'me' : true)).filter((p) => (p.name + ' ' + p.theme).toLowerCase().includes(q.toLowerCase())), [state.playlists, tab, q]);
  const invested = new Set(state.playlistInvestments.map((i) => i.playlistId));
  return <AppShell title="Playlists" action={<Link href="/playlists/new" className="btn btn-primary btn-sm">Create</Link>}>
    <p className="muted" style={{ margin: 0 }}>A playlist is a themed collection of investments with weights you can see. Invest in one, or build your own.</p>
    <Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All playlists' }, { value: 'mine', label: 'Mine' }]} />
    <TextField label="Search" placeholder="Try energy or income" value={q} onChange={(e) => setQ(e.target.value)} />
    {list.length === 0 ? <Empty title={tab === 'mine' ? 'You have not made a playlist' : 'No playlists match'} text={tab === 'mine' ? 'Pick a theme, choose some investments and set their weights.' : 'Try a different word.'} action={tab === 'mine' ? <Link className="btn btn-primary" href="/playlists/new">Build one</Link> : undefined} /> :
      list.map((p) => <Link key={p.id} href={`/playlists/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row between"><span className="chip">{p.theme || 'Custom'}</span>{invested.has(p.id) && <span className="chip" style={{ background: 'var(--c-accent-soft)', color: 'var(--c-on-accent-soft)' }}>Invested</span>}</div>
        <div className="h2">{p.name}</div><p className="muted" style={{ margin: 0 }}>{p.description || 'Your own mix.'}</p>
        <div className="row wrap">{p.items.slice(0, 3).map((i) => <span key={i.ticker} className="chip">{i.ticker}</span>)}<span className="muted">{p.items.length} holdings</span></div></Link>)}
    <Link href="/crypto" className="card" style={{ textDecoration: 'none', color: 'inherit' }}><div className="h2">Simulated coins</div><p className="muted" style={{ margin: 0 }}>Feel how wild digital coins can swing, using pretend coins and practice money.</p></Link>
  </AppShell>;
}
