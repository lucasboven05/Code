'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Button, Empty } from '@/components/ui';
import { dateFmt } from '@/lib/format';

const LABEL = { contribution: 'Contribution', rebalance: 'Rebalance', briefing: 'Briefing', recap: 'Recap' } as const;
const HREF = { contribution: '/activity', rebalance: '/activity', briefing: '/briefing', recap: '/home' } as const;
export default function Inbox() {
  const { state, data, act } = useApp();
  const list = useMemo(() => state.inbox.map((n, i) => ({ n, i })).sort((a, b) => b.n.date.localeCompare(a.n.date) || b.i - a.i).map((x) => x.n), [state.inbox]);
  const unread = state.inbox.filter((n) => !n.read).length;
  return <AppShell title="Inbox" back="/home" action={unread > 0 ? <Button size="sm" variant="secondary" onClick={() => act(data.markAllNoticesRead())}>Mark all read</Button> : undefined}>
    {list.length === 0 ? <Empty title="Nothing here yet" text="When a scheduled purchase happens, your mix is rebalanced, or a new day's briefing or weekly recap is ready, it shows up here. You choose what you get in Settings." action={<Link className="btn btn-secondary" href="/settings">Notification settings</Link>} /> :
      <section className="card" aria-label="Notifications">{list.map((n) => <Link key={n.id} href={HREF[n.kind]} className="list-row" style={{ alignItems: 'flex-start' }}>
        <div><div className="row wrap">{!n.read && <><span className="unread-dot" aria-hidden /><span className="sr-only">Unread. </span></>}<b>{n.title}</b><span className="chip">{LABEL[n.kind]}</span></div>
          <div style={{ marginTop: 4 }}>{n.text}</div><div className="muted">{dateFmt(n.date)}</div></div></Link>)}</section>}
  </AppShell>;
}
