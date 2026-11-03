'use client';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/Provider';
import { AppShell } from '@/components/Shell';
import { Empty, Segmented, Button } from '@/components/ui';
import { dateFmt, qtyFmt, usd } from '@/lib/format';

const LABEL: Record<string, string> = { deposit: 'Practice deposit', buy: 'Bought', sell: 'Sold', rebalance_buy: 'Rebalance: bought', rebalance_sell: 'Rebalance: sold', withdrawal: 'Withdrawal' };
const isCash = (k: string) => k === 'deposit' || k === 'withdrawal';
export default function Activity() {
  const { state } = useApp(); const [f, setF] = useState<'all' | 'trades' | 'cash'>('all'); const [n, setN] = useState(25);
  const list = useMemo(() => [...state.orders].reverse().filter((o) => (f === 'all' ? true : f === 'cash' ? isCash(o.kind) : !isCash(o.kind))), [state.orders, f]);
  return <AppShell title="Activity" back="/home">
    <Segmented label="Filter" value={f} onChange={(v) => { setF(v); setN(25); }} options={[{ value: 'all', label: 'All' }, { value: 'trades', label: 'Trades' }, { value: 'cash', label: 'Cash' }]} />
    {list.length === 0 ? <Empty title="No activity yet" text="Deposits, purchases and rebalances will be listed here." /> : <section className="card">
      {list.slice(0, n).map((o) => <div key={o.id} className="list-row"><div><b>{LABEL[o.kind]} {o.ticker ?? ''}</b><div className="muted">{dateFmt(o.date)}{o.qty ? ` · ${qtyFmt(o.qty)} at ${usd(Math.round((o.price ?? 0) * 100))}` : ''}{o.note ? ` · ${o.note}` : ''}</div></div><b>{usd(o.amountCents)}</b></div>)}
      {list.length > n && <Button variant="secondary" onClick={() => setN(n + 25)}>Show more</Button>}</section>}
  </AppShell>;
}
