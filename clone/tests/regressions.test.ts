// Regression tests for bugs found by replica-test (see replica/bugs.md).
import { describe, expect, it } from 'vitest';
import { Service, type Store } from '@/lib/data';
import { normalizeState } from '@/lib/engine';
import { toCents } from '@/lib/format';
import type { State } from '@/lib/types';

const memory = (): Store & { saved: State | null } => { const s: any = { saved: null, load: async () => s.saved, save: async (x: State) => { s.saved = JSON.parse(JSON.stringify(x)); }, clear: async () => { s.saved = null; } }; return s; };
const svc = (now: string, tz = 'America/Panama') => { const store = memory(); const sv = new Service(store, () => new Date(now)); sv.state.profile.timezone = tz; return { sv, store }; };
async function onboarded(now = '2026-06-15T15:00:00Z', tz?: string) { const { sv, store } = svc(now, tz); await sv.saveProfile({ riskTolerance: 3, horizonYears: 8, step: 5 }); await sv.completeOnboarding({ amountCents: 5000, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 5, start: 'today' }); return { sv, store }; }

describe('BUG-04 money input parsing', () => {
  it.each([['12', 1200], ['12.5', 1250], ['12.50', 1250], ['$1,000.50', 100050], [' 7 ', 700], ['1,000', 100000], ['100.', 10000]])('accepts %s', (t, c) => expect(toCents(t)).toBe(c));
  it.each(['5 0', '1,0,0', '1e3', '0x10', '١٠٠', '12.345', '-5', '', '  ', 'abc', '$', '.5', '1,00', '$$5', '1 000', '0', '0.00'])('rejects "%s"', (t) => expect(toCents(t)).toBeNull());
});
describe('BUG-02 a plan can only be created once', () => {
  it('a second completeOnboarding is refused and creates nothing', async () => {
    const { sv } = await onboarded(); const n = sv.state.contributions.length;
    await expect(sv.completeOnboarding({ amountCents: 5000, frequency: 'weekly', dayOfWeek: 1, dayOfMonth: null, start: '6m' })).rejects.toThrow(/already set up/); expect(sv.state.contributions.length).toBe(n);
  });
});
describe('BUG-05 the simulation never acts on a day that has not begun in New York', () => {
  it('Tokyo at 05:00 on Nov 3 uses Nov 2', () => { expect(svc('2026-11-02T20:00:00Z', 'Asia/Tokyo').sv.today()).toBe('2026-11-02'); });
  it('Los Angeles late on Nov 2 uses its own date', () => { expect(svc('2026-11-03T06:00:00Z', 'America/Los_Angeles').sv.today()).toBe('2026-11-02'); });
  it('Panama and New York agree', () => { expect(svc('2026-11-02T20:00:00Z', 'America/Panama').sv.today()).toBe('2026-11-02'); });
});
describe('BUG-06 stored data of any shape is recovered, never a crash', () => {
  it.each([[null], ['x'], [5], [[]], [{}], [{ v: 2 }]])('rejects non-state %j', (raw) => expect(normalizeState(raw)).toBeNull());
  it('fills in everything missing and keeps what is valid', () => {
    const s = normalizeState({ v: 1, profile: { onboardedAt: '2026-01-05', displayName: 'Sam', timezone: 'Europe/London' }, account: { cashCents: 123 }, orders: 'x', holdings: [{ ticker: 'S-US', qty: 1, costBasisCents: 100 }, 7, null] })!;
    expect(s.profile.displayName).toBe('Sam'); expect(s.profile.timezone).toBe('Europe/London'); expect(s.account).toMatchObject({ cashCents: 123, rebalanceEnabled: true }); expect(s.orders).toEqual([]); expect(s.holdings).toHaveLength(1);
    expect(s.playlists.length).toBeGreaterThanOrEqual(5); expect(s.prefs.dailyBriefing).toBe(true);
  });
  it('keeps the user\'s own playlists and drops malformed ones', () => {
    const own = { id: 'x1', owner: 'me', name: 'Mine', theme: '', description: '', isPublic: false, items: [{ ticker: 'S-US', weightBps: 10000 }] };
    const s = normalizeState({ v: 1, playlists: [own, { id: 'bad', owner: 'me' }, { id: 'p-clean', owner: null, items: [] }] })!; expect(s.playlists.filter((p) => p.owner === 'me').map((p) => p.id)).toEqual(['x1']);
  });
});
describe('BUG-08/12 the same limits apply here as on the server', () => {
  it('money actions need $1.00 to $100,000.00', async () => {
    const { sv } = await onboarded();
    for (const bad of [0, 50, 99, 10_000_001, 12.5, -100, NaN]) { await expect(sv.addMoney(bad), String(bad)).rejects.toThrow(/between \$1\.00 and \$100,000\.00/); await expect(sv.investInPlaylist('p-clean', bad), String(bad)).rejects.toThrow(); }
    await expect(sv.addMoney(100)).resolves.toBeTruthy(); await expect(sv.addMoney(10_000_000)).resolves.toBeTruthy();
  });
  it('goals need a target of at least $1.00', async () => {
    const { sv } = await onboarded(); await expect(sv.saveGoal({ name: 'x', targetCents: 50, targetYear: 2030 })).rejects.toThrow(/at least \$1\.00/); await expect(sv.saveGoal({ name: 'x', targetCents: 100, targetYear: 2030 })).resolves.toBeTruthy();
  });
});
describe('BUG-07 two tabs share one account', () => {
  it('a change made elsewhere is picked up before the next change is applied', async () => {
    const store = memory(); const a = new Service(store, () => new Date('2026-06-15T15:00:00Z')); const b = new Service(store, () => new Date('2026-06-15T15:00:00Z'));
    for (const s of [a, b]) (s as any).refresh = async function (this: Service) { const x = await store.load(); if (x) this.state = x; };
    await a.saveProfile({ riskTolerance: 3, horizonYears: 8, step: 5 }); await a.completeOnboarding({ amountCents: 5000, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 5, start: 'today' }); await b.load();
    const base = store.saved!.account.cashCents; await a.addMoney(1000); await b.addMoney(2000);
    expect(store.saved!.account.cashCents).toBe(base + 3000);
  });
});
