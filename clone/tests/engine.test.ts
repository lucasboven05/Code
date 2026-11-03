import { describe, expect, it } from 'vitest';
import { advance, buyBasket, dailyJobs, deposit, emptyState, firstRun, matchPortfolio, monthlyNeeded, projectValue, rebalance, runDue, runJobs, totalValueCents, valueSeries } from '@/lib/engine';
import { MODELS, BUILTIN_PLAYLISTS } from '@/lib/seed';
import { priceAt } from '@/lib/prices';
import { addDays, isTradingDay, nextTradingDay, todayIn } from '@/lib/calendar';
import type { State } from '@/lib/types';

const T = '2026-03-04'; // a Wednesday, trading day
function withPlan(modelId = 'm3', amount = 5000): State {
  let s = emptyState(); s.account.modelId = modelId;
  s.contributions.push({ id: 'c1', amountCents: amount, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 4, nextRunOn: T, status: 'active' });
  return s;
}

describe('sample data', () => {
  it('every model and playlist totals exactly 100%', () => {
    for (const m of MODELS) expect(m.allocations.reduce((t, a) => t + a.weightBps, 0), m.name).toBe(10000);
    for (const p of BUILTIN_PLAYLISTS) expect(p.items.reduce((t, a) => t + a.weightBps, 0), p.name).toBe(10000);
  });
  it('prices are deterministic and positive', () => { expect(priceAt('S-US', T)).toBe(priceAt('S-US', T)); expect(priceAt('X-TOK', T)).toBeGreaterThan(0); });
});

describe('matching', () => {
  it('short horizon lowers risk, never below 1', () => {
    const base = emptyState().profile;
    expect(matchPortfolio({ ...base, riskTolerance: 4, horizonYears: 10 }, 2026).riskLevel).toBe(4);
    expect(matchPortfolio({ ...base, riskTolerance: 4, horizonYears: 2 }, 2026).riskLevel).toBe(2);
    expect(matchPortfolio({ ...base, riskTolerance: 1, horizonYears: 1 }, 2026).riskLevel).toBe(1);
  });
});

describe('buying', () => {
  it('never spends more than given; fractional shares; leftover stays cash', () => {
    let s = deposit(emptyState(), 10001, T);
    s = buyBasket(s, 10001, MODELS[2].allocations, T, priceAt);
    const spent = s.orders.filter((o) => o.kind === 'buy').reduce((t, o) => t + o.amountCents, 0);
    expect(spent).toBeLessThanOrEqual(10001);
    expect(s.account.cashCents).toBe(10001 - spent);
    expect(s.holdings.some((h) => h.qty % 1 !== 0)).toBe(true);
    expect(s.account.cashCents).toBeGreaterThanOrEqual(0);
  });
  it('refuses to spend cash it does not have', () => { expect(() => buyBasket(emptyState(), 100, MODELS[0].allocations, T, priceAt)).toThrow(); });
  it('rejects non-integer or non-positive deposits', () => { expect(() => deposit(emptyState(), 10.5, T)).toThrow(); expect(() => deposit(emptyState(), 0, T)).toThrow(); });
});

describe('scheduled contributions', () => {
  it('run once per scheduled day even if the job fires twice', () => {
    const a = runDue(withPlan(), T, priceAt); const b = runDue(a, T, priceAt);
    expect(b.orders.filter((o) => o.kind === 'deposit').length).toBe(1);
    expect(b.orders.length).toBe(a.orders.length);
    expect(b.contributions[0].nextRunOn).toBe('2026-04-04'); // Saturday: waits for the next trading day when it comes due
  });
  it('skip weekends and market holidays, then run on the next trading day', () => {
    expect(isTradingDay('2026-04-03')).toBe(false); expect(isTradingDay('2026-03-07')).toBe(false);
    let s = withPlan(); s.contributions[0].nextRunOn = '2026-04-03'; // Good Friday
    expect(runDue(s, '2026-04-03', priceAt).orders.length).toBe(0);
    expect(runDue(s, '2026-04-06', priceAt).orders.length).toBeGreaterThan(0);
  });
  it('catch-up after days away executes each missed run exactly once', () => {
    let s = withPlan(); s.lastJobsOn = '2026-02-28';
    s = runJobs(s, '2026-06-30', priceAt);
    expect(s.orders.filter((o) => o.kind === 'deposit').length).toBe(4); // Mar, Apr, May, Jun
    expect(runJobs(s, '2026-06-30', priceAt).orders.length).toBe(s.orders.length);
  });
  it('one-time contribution finishes', () => {
    let s = withPlan(); s.contributions[0].frequency = 'once'; s = runDue(s, T, priceAt);
    expect(s.contributions[0].status).toBe('done'); expect(s.contributions[0].nextRunOn).toBeNull();
  });
  it('schedule maths: first run and advance', () => {
    expect(firstRun({ frequency: 'weekly', dayOfWeek: 1, dayOfMonth: null }, T)).toBe('2026-03-09');
    expect(firstRun({ frequency: 'monthly', dayOfWeek: null, dayOfMonth: 31 }, '2026-01-30')).toBe('2026-02-28');
    expect(advance({ frequency: 'biweekly', dayOfMonth: null }, T)).toBe('2026-03-18');
    expect(advance({ frequency: 'monthly', dayOfMonth: 31 }, '2026-01-28')).toBe('2026-02-28');
  });
});

describe('rebalancing', () => {
  it('does nothing inside the tolerance and conserves value when it acts', () => {
    let s = runDue(withPlan('m4', 100000), T, priceAt);
    expect(rebalance(s, T, priceAt)).toBe(s); // freshly bought: no drift
    const later = nextTradingDay('2026-09-01');
    const before = totalValueCents(s, later, priceAt);
    const r = rebalance(s, later, priceAt, 0);
    expect(Math.abs(totalValueCents(r, later, priceAt) - before)).toBeLessThanOrEqual(r.orders.length * 2 + 5);
    expect(r.account.cashCents).toBeGreaterThanOrEqual(0);
    const model = MODELS[3]; const V = model.allocations.reduce((t, a) => t + (r.holdings.find((h) => h.ticker === a.ticker)?.qty ?? 0) * priceAt(a.ticker, later) * 100, 0);
    for (const a of model.allocations) {
      const w = ((r.holdings.find((h) => h.ticker === a.ticker)?.qty ?? 0) * priceAt(a.ticker, later) * 100) / V * 10000;
      expect(Math.abs(w - a.weightBps)).toBeLessThan(30);
    }
  });
});

describe('history and projections', () => {
  it('replayed value at the last date equals live valuation', () => {
    let s = runJobs({ ...withPlan(), lastJobsOn: '2026-02-28' }, '2026-06-30', priceAt);
    const series = valueSeries(s, ['2026-03-04', '2026-06-30'], priceAt);
    expect(series[1].valueCents).toBe(totalValueCents(s, '2026-06-30', priceAt));
    expect(series[1].netDepositsCents).toBe(s.account.netDepositsCents);
  });
  it('projection matches the closed form and is monotonic in the rate', () => {
    expect(projectValue(0, 10000, 0, 0.05)).toBe(0);
    expect(projectValue(100000, 0, 10, 0.05)).toBeCloseTo(100000 * 1.05 ** 10, 4);
    expect(projectValue(0, 10000, 10, 0)).toBe(1200000);
    expect(projectValue(50000, 5000, 10, 0.07)).toBeGreaterThan(projectValue(50000, 5000, 10, 0.03));
  });
  it('monthlyNeeded reaches the target', () => {
    const need = monthlyNeeded(5_000_000, 100000, 10, 0.05);
    expect(projectValue(100000, need, 10, 0.05)).toBeGreaterThanOrEqual(5_000_000 - 1);
    expect(monthlyNeeded(100, 100000, 10, 0.05)).toBe(0);
  });
});

describe('time zones', () => {
  it('Panama and New York can disagree about the date', () => {
    const now = new Date('2026-11-03T03:30:00Z'); // 22:30 Nov 2 in Panama (UTC-5), 22:30 Nov 2 in NY (EST)
    expect(todayIn('America/Panama', now)).toBe('2026-11-02');
    expect(todayIn('Asia/Tokyo', now)).toBe('2026-11-03');
  });
  it('dailyJobs does nothing on a weekend', () => { const s = withPlan(); expect(dailyJobs(s, '2026-03-07', priceAt)).toBe(s); });
});
