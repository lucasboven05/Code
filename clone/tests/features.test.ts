import { describe, expect, it } from 'vitest';
import { Service, type Store } from '@/lib/data';
import { addNotices, markAllRead, normalizeState } from '@/lib/engine';
import { priceAt, range } from '@/lib/prices';
import { drivers, stockStats, swingText } from '@/lib/stats';
import { addDays } from '@/lib/calendar';
import type { State } from '@/lib/types';

const memory = (): Store & { saved: State | null } => { const s: any = { saved: null, load: async () => s.saved, save: async (x: State) => { s.saved = JSON.parse(JSON.stringify(x)); }, clear: async () => { s.saved = null; } }; return s; };
const mk = (now: string) => { const store = memory(); const clock = { now }; const sv = new Service(store, () => new Date(clock.now)); return { sv, store, clock }; };
async function setup(now: string, over: Partial<{ freq: 'weekly' | 'monthly' | 'once'; start: 'today' | '6m' | '1y' }> = {}) {
  const t = mk(now); await t.sv.saveProfile({ riskTolerance: 4, horizonYears: 8, step: 5 });
  await t.sv.completeOnboarding({ amountCents: 5000, frequency: over.freq ?? 'weekly', dayOfWeek: 1, dayOfMonth: 5, start: over.start ?? '6m' }); return t;
}
const kinds = (s: State) => s.inbox.map((n) => n.kind);

describe('stock key figures', () => {
  it('computes range, change, daily swing and worst fall from known prices', () => {
    const closes = Array.from({ length: 40 }, (_, i) => (i < 20 ? 100 + i : 119 - (i - 19) * 2));     // up to 119 then down by 2 a day
    const s = stockStats(closes)!; expect(s.high).toBe(119); expect(s.low).toBe(closes[closes.length - 1]); expect(s.worstFallPct).toBeCloseTo((closes[39] / 119 - 1) * 100, 6);
    expect(s.changePct).toBeCloseTo((closes[39] / 100 - 1) * 100, 6); expect(s.swingPct).toBeGreaterThan(0);
  });
  it('a flat price has no swing and no fall', () => { const s = stockStats(Array(60).fill(50))!; expect(s.swingPct).toBe(0); expect(s.worstFallPct).toBe(0); expect(s.swing).toBe('calm'); });
  it('refuses too little or invalid data instead of returning NaN', () => { expect(stockStats([1, 2, 3])).toBeNull(); expect(stockStats(Array(40).fill(0))).toBeNull(); expect(stockStats([...Array(39).fill(5), NaN])).toBeNull(); });
  it('calmer investments really measure calmer than wilder ones', () => {
    const f = (t: string) => stockStats(range(t, '2025-11-01', '2026-11-01').map((p) => p.close))!;
    expect(f('S-STB').swingPct).toBeLessThan(f('S-US').swingPct); expect(f('S-US').swingPct).toBeLessThan(f('X-TOK').swingPct);
    expect(f('S-STB').swing).toBe('calm'); expect(f('X-TOK').swing).toBe('wild');
  });
  it('has plain text for every kind', () => { for (const t of ['etf', 'stock', 'crypto']) expect(drivers(t).length).toBeGreaterThan(40); for (const k of ['calm', 'moderate', 'wild'] as const) expect(swingText(k)).toBeTruthy(); });
  it('is exposed on the data layer for every instrument', async () => {
    const { sv } = await setup('2026-11-04T15:00:00Z', { freq: 'once', start: 'today' }); for (const t of ['S-US', 'FX-SOLR', 'X-COIN']) { const x = sv.stock(t); expect(x.stats, t).not.toBeNull(); expect(Number.isFinite(x.stats!.swingPct)).toBe(true); }
  });
});

describe('inbox', () => {
  it('a new account gets a contribution notice, a briefing and a recap, once', async () => {
    const { sv } = await setup('2026-11-04T15:00:00Z', { freq: 'once', start: 'today' }); expect(kinds(sv.state).sort()).toEqual(['briefing', 'contribution', 'recap']);
    await sv.load(); await sv.load(); expect(sv.state.inbox).toHaveLength(3);                              // loading again adds nothing
  });
  it('replaying six months does not flood the inbox: only the last 7 days are announced', async () => {
    const { sv } = await setup('2026-11-04T15:00:00Z', { freq: 'weekly', start: '6m' });
    expect(sv.state.orders.filter((o) => o.kind === 'deposit').length).toBeGreaterThan(20);
    const c = sv.state.inbox.filter((n) => n.kind === 'contribution'); expect(c).toHaveLength(1); expect(c[0].date).toBe('2026-11-02');
    expect(sv.state.inbox.length).toBeLessThanOrEqual(6);
  });
  it('a week later brings the next contribution, a new briefing and a new recap', async () => {
    const t = await setup('2026-11-04T15:00:00Z'); t.clock.now = '2026-11-11T15:00:00Z'; await t.sv.load();
    expect(t.sv.state.inbox.filter((n) => n.kind === 'recap')).toHaveLength(2); expect(t.sv.state.inbox.filter((n) => n.kind === 'contribution').map((n) => n.date)).toEqual(['2026-11-02', '2026-11-09']);
    expect(t.sv.state.inbox.filter((n) => n.kind === 'briefing').map((n) => n.date)).toContain('2026-11-11');
  });
  it('turning a notification off stops that kind and nothing else', async () => {
    const t = await setup('2026-11-04T15:00:00Z'); await t.sv.markAllNoticesRead(); await t.sv.setPrefs({ contributionDone: false, dailyBriefing: false }); const before = t.sv.state.inbox.length;
    t.clock.now = '2026-11-11T15:00:00Z'; await t.sv.load(); const added = t.sv.state.inbox.slice(before).map((n) => n.kind); expect(added).toEqual(['recap']);
  });
  it('rebalancing is announced once per day with the number of trades', () => {
    const base = normalizeState({ v: 1, profile: { onboardedAt: '2026-01-05' }, account: { modelId: 'm3' }, holdings: [{ ticker: 'S-US', qty: 1, costBasisCents: 100 }] })!;
    const after = { ...base, orders: [{ id: 'a', kind: 'rebalance_sell', ticker: 'S-US', qty: 1, price: 1, amountCents: 100, date: '2026-11-02', note: '' }, { id: 'b', kind: 'rebalance_buy', ticker: 'S-BND', qty: 1, price: 1, amountCents: 100, date: '2026-11-02', note: '' }] } as State;
    const out = addNotices(base, after, '2026-11-04', priceAt); const r = out.inbox.filter((n) => n.kind === 'rebalance'); expect(r).toHaveLength(1); expect(r[0].text).toMatch(/^2 trades/);
  });
  it('is capped at 100, newest kept', () => {
    const base = normalizeState({ v: 1, profile: { onboardedAt: '2026-01-05' }, holdings: [{ ticker: 'S-US', qty: 1, costBasisCents: 100 }], inbox: Array.from({ length: 150 }, (_, i) => ({ id: 'n' + i, kind: 'recap', title: 't', text: 'x', date: addDays('2025-01-01', i), read: true })) })!;
    expect(addNotices(base, base, '2026-11-04', priceAt).inbox).toHaveLength(100);
  });
  it('mark all read, and bad stored notices are dropped', async () => {
    const { sv } = await setup('2026-11-04T15:00:00Z'); expect(sv.state.inbox.every((n) => !n.read)).toBe(true); await sv.markAllNoticesRead(); expect(sv.state.inbox.every((n) => n.read)).toBe(true);
    expect(markAllRead(sv.state).inbox.length).toBe(sv.state.inbox.length);
    expect(normalizeState({ v: 1, inbox: [{ id: 1 }, null, { id: 'ok', kind: 'recap', title: 't', text: 'x', date: '2026-01-01' }] })!.inbox.map((n) => n.id)).toEqual(['ok']);
  });
});

describe('Allie answers the question that "Ask Allie about this" hands over', () => {
  it.each(['Sample US Broad Market Fund', 'Quantaware Systems (fictional)', 'Sample Coin (simulated)', 'Sample Dividend Fund'])('for %s', async (name) => {
    const { sv } = await setup('2026-11-04T15:00:00Z', { freq: 'once', start: 'today' }); await sv.sendChat(`What drives ${name} and how risky is it?`);
    const reply = sv.state.chat.at(-1)!.content; expect(reply).toMatch(/How far prices can swing|how far prices can swing/); expect(reply).toMatch(/typical daily move/); expect(reply).not.toMatch(/^A fund \(often an ETF\)/);
  });
});
