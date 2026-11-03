// Pure simulation engine: no storage, no UI, no clock. Everything takes the date and a price function.
// Money is integer cents. Quantities are floored to 8 decimals so a buy never spends more than it was given.
import { MODELS, BUILTIN_PLAYLISTS } from './seed';
import { addDays, addMonths, isTradingDay, prevTradingDay, toDate, weekday } from './calendar';
import type { Alloc, Contribution, Frequency, ModelPortfolio, Order, OrderKind, PriceAt, Profile, State } from './types';

export const BPS = 10000;

export function emptyState(timezone = 'America/Panama'): State {
  return {
    v: 1,
    profile: { displayName: '', birthYear: null, riskTolerance: null, horizonYears: null, goals: [], step: 0, onboardedAt: null, timezone },
    account: { cashCents: 0, netDepositsCents: 0, modelId: null, rebalanceEnabled: true },
    holdings: [], contributions: [], orders: [], goals: [], playlists: BUILTIN_PLAYLISTS.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })),
    playlistInvestments: [], chat: [], prefs: { dailyBriefing: true, contributionDone: true, rebalanceDone: true },
    lastJobsOn: null, seq: 0,
  };
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Pick the sample portfolio whose risk level fits the answers. Educational, not advice. */
export function matchPortfolio(p: Profile, year = new Date().getFullYear(), models: ModelPortfolio[] = MODELS): ModelPortfolio {
  let level = p.riskTolerance ?? 3;
  if (p.horizonYears != null) { if (p.horizonYears <= 2) level -= 2; else if (p.horizonYears <= 5) level -= 1; }
  if (p.birthYear != null && year - p.birthYear >= 60) level -= 1;
  level = Math.min(5, Math.max(1, level));
  return models.find((m) => m.riskLevel === level) ?? models[2];
}

function newId(s: State, _prefix: string) { s.seq += 1; return globalThis.crypto.randomUUID(); }
const holdingValue = (qty: number, price: number) => qty * price * 100;

export function totalValueCents(s: State, date: string, priceAt: PriceAt): number {
  return Math.round(s.account.cashCents + s.holdings.reduce((t, h) => t + holdingValue(h.qty, priceAt(h.ticker, date)), 0));
}

function pushOrder(s: State, kind: OrderKind, date: string, amountCents: number, extra: Partial<Order> = {}) {
  s.orders.push({ id: newId(s, 'o'), kind, date, amountCents, note: '', ...extra });
}

/** Simulated bank transfer into the practice account. */
export function deposit(state: State, amountCents: number, date: string, meta: Partial<Order> = {}): State {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Amount must be a positive whole number of cents');
  const s = clone(state);
  s.account.cashCents += amountCents; s.account.netDepositsCents += amountCents;
  pushOrder(s, 'deposit', date, amountCents, meta);
  return s;
}

/** Spend `amountCents` of cash across `allocs`. Rounds quantities down; leftover stays as cash. */
export function buyBasket(state: State, amountCents: number, allocs: Alloc[], date: string, priceAt: PriceAt, meta: Partial<Order> = {}, kind: OrderKind = 'buy'): State {
  if (amountCents > state.account.cashCents) throw new Error('Not enough cash');
  const s = clone(state);
  for (const a of allocs) {
    const spend = Math.floor((amountCents * a.weightBps) / BPS);
    if (spend <= 0) continue;
    const price = priceAt(a.ticker, date);
    const qty = Math.floor((spend / 100 / price) * 1e8) / 1e8;
    if (qty <= 0) continue;
    const cost = Math.min(spend, Math.round(qty * price * 100));
    if (cost <= 0) continue;
    if (cost > s.account.cashCents) throw new Error('Not enough cash');
    const h = s.holdings.find((x) => x.ticker === a.ticker);
    if (h) { h.qty = Math.round((h.qty + qty) * 1e8) / 1e8; h.costBasisCents += cost; } else s.holdings.push({ ticker: a.ticker, qty, costBasisCents: cost });
    s.account.cashCents -= cost;
    pushOrder(s, kind, date, cost, { ticker: a.ticker, qty, price, ...meta });
  }
  return s;
}

export function firstRun(c: Pick<Contribution, 'frequency' | 'dayOfWeek' | 'dayOfMonth'>, start: string): string {
  if (c.frequency === 'once') return start;
  if (c.frequency === 'monthly') {
    const dom = Math.min(c.dayOfMonth ?? 1, 28); const d = toDate(start);
    const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), dom)).toISOString().slice(0, 10);
    return thisMonth >= start ? thisMonth : addMonths(start, 1, dom);
  }
  let d = start; while (weekday(d) !== (c.dayOfWeek ?? 1)) d = addDays(d, 1); return d;
}
export function advance(c: Pick<Contribution, 'frequency' | 'dayOfMonth'>, runFor: string): string | null {
  const f: Frequency = c.frequency;
  if (f === 'once') return null;
  if (f === 'weekly') return addDays(runFor, 7);
  if (f === 'biweekly') return addDays(runFor, 14);
  return addMonths(runFor, 1, c.dayOfMonth ?? 1);
}

/** Execute every scheduled contribution due on `date`. Safe to call twice: a run is keyed by contribution + scheduled day. */
export function runDue(state: State, date: string, priceAt: PriceAt): State {
  if (!isTradingDay(date)) return state;
  let s = state;
  for (const cid of state.contributions.map((c) => c.id)) {
    let guard = 0;
    for (;;) {
      const c = s.contributions.find((x) => x.id === cid)!;
      if (c.status !== 'active' || !c.nextRunOn || c.nextRunOn > date || guard++ > 24) break;
      const runFor = c.nextRunOn;
      const done = s.orders.some((o) => o.contributionId === c.id && o.runFor === runFor && o.kind === 'deposit');
      const model = MODELS.find((m) => m.id === s.account.modelId);
      if (!done && model) {
        const meta = { contributionId: c.id, runFor };
        s = deposit(s, c.amountCents, date, { ...meta, note: 'Scheduled contribution' });
        s = buyBasket(s, c.amountCents, model.allocations, date, priceAt, { ...meta, note: model.name + ' plan' });
      }
      s = clone(s);
      const cc = s.contributions.find((x) => x.id === cid)!;
      const nxt = advance(cc, runFor);
      if (nxt) cc.nextRunOn = nxt; else { cc.nextRunOn = null; cc.status = 'done'; }
    }
  }
  return s;
}

/** Move holdings of the chosen sample portfolio back toward target if any weight drifted past the threshold. */
export function rebalance(state: State, date: string, priceAt: PriceAt, thresholdBps = 300): State {
  const model = MODELS.find((m) => m.id === state.account.modelId);
  if (!model || !isTradingDay(date)) return state;
  const val = (t: string) => { const h = state.holdings.find((x) => x.ticker === t); return h ? holdingValue(h.qty, priceAt(t, date)) : 0; };
  const V = model.allocations.reduce((t, a) => t + val(a.ticker), 0);
  if (V <= 0) return state;
  const drift = Math.max(...model.allocations.map((a) => Math.abs((val(a.ticker) / V) * BPS - a.weightBps)));
  if (drift <= thresholdBps) return state;
  const s = clone(state);
  for (const a of model.allocations) {            // sells first, so there is cash for the buys
    const price = priceAt(a.ticker, date); const target = (V * a.weightBps) / BPS; const h = s.holdings.find((x) => x.ticker === a.ticker);
    if (!h) continue;
    const over = holdingValue(h.qty, price) - target;
    if (over < 100) continue;
    const qty = Math.min(h.qty, Math.floor((over / 100 / price) * 1e8) / 1e8); if (qty <= 0) continue;
    const proceeds = Math.round(qty * price * 100); if (proceeds <= 0) continue; const frac = qty / h.qty;
    h.costBasisCents = Math.round(h.costBasisCents * (1 - frac)); h.qty = Math.round((h.qty - qty) * 1e8) / 1e8;
    s.account.cashCents += proceeds; pushOrder(s, 'rebalance_sell', date, proceeds, { ticker: a.ticker, qty, price, note: 'Back toward your mix' });
  }
  for (const a of model.allocations) {
    const price = priceAt(a.ticker, date); const target = (V * a.weightBps) / BPS;
    const cur = (() => { const h = s.holdings.find((x) => x.ticker === a.ticker); return h ? holdingValue(h.qty, price) : 0; })();
    const under = target - cur; if (under < 100) continue;
    const spend = Math.min(Math.floor(under), s.account.cashCents);
    const qty = Math.floor((spend / 100 / price) * 1e8) / 1e8; if (qty <= 0) continue;
    const cost = Math.min(spend, Math.round(qty * price * 100)); if (cost <= 0) continue;
    const h = s.holdings.find((x) => x.ticker === a.ticker);
    if (h) { h.qty = Math.round((h.qty + qty) * 1e8) / 1e8; h.costBasisCents += cost; } else s.holdings.push({ ticker: a.ticker, qty, costBasisCents: cost });
    s.account.cashCents -= cost; pushOrder(s, 'rebalance_buy', date, cost, { ticker: a.ticker, qty, price, note: 'Back toward your mix' });
  }
  s.holdings = s.holdings.filter((h) => h.qty > 0);
  return s;
}

const firstTradingDayOfWeek = (date: string) => weekday(prevTradingDay(addDays(date, -1))) >= weekday(date);

/** What the daily cron would do for one calendar day. */
export function dailyJobs(state: State, date: string, priceAt: PriceAt): State {
  if (!isTradingDay(date)) return state;
  let s = runDue(state, date, priceAt);
  if (s.account.rebalanceEnabled && firstTradingDayOfWeek(date)) s = rebalance(s, date, priceAt);
  return s;
}
/** Catch up every day since the last run (the app was closed) through `today`. */
export function runJobs(state: State, today: string, priceAt: PriceAt): State {
  let s = state; let d = state.lastJobsOn ? addDays(state.lastJobsOn, 1) : today;
  for (; d <= today; d = addDays(d, 1)) s = dailyJobs(s, d, priceAt);
  if (s.lastJobsOn === today) return s;
  s = clone(s); s.lastJobsOn = today; return s;
}

export type ValuePoint = { date: string; valueCents: number; netDepositsCents: number };
/** Portfolio value on each date, replayed from the order log at that day's prices. */
export function valueSeries(state: State, dates: string[], priceAt: PriceAt): ValuePoint[] {
  const orders = [...state.orders].sort((a, b) => a.date.localeCompare(b.date));
  let i = 0, cash = 0, net = 0; const qty = new Map<string, number>(); const out: ValuePoint[] = [];
  for (const d of dates) {
    for (; i < orders.length && orders[i].date <= d; i++) {
      const o = orders[i];
      if (o.kind === 'deposit') { cash += o.amountCents; net += o.amountCents; }
      else if (o.kind === 'buy' || o.kind === 'rebalance_buy') { cash -= o.amountCents; qty.set(o.ticker!, (qty.get(o.ticker!) ?? 0) + o.qty!); }
      else { cash += o.amountCents; qty.set(o.ticker!, (qty.get(o.ticker!) ?? 0) - o.qty!); }
    }
    let v = cash; qty.forEach((q, t) => { v += holdingValue(q, priceAt(t, d)); });
    out.push({ date: d, valueCents: Math.round(v), netDepositsCents: net });
  }
  return out;
}

/** Hypothetical growth: monthly compounding of an annual rate, contributions added at month end. */
export function projectValue(startCents: number, monthlyCents: number, years: number, annualRate: number): number {
  const m = Math.pow(1 + annualRate, 1 / 12) - 1; const k = Math.round(years * 12);
  if (m === 0) return startCents + monthlyCents * k;
  return startCents * Math.pow(1 + m, k) + (monthlyCents * (Math.pow(1 + m, k) - 1)) / m;
}
export function projectionSeries(startCents: number, monthlyCents: number, years: number, annualRate: number): number[] {
  return Array.from({ length: Math.max(0, Math.round(years)) + 1 }, (_, y) => projectValue(startCents, monthlyCents, y, annualRate));
}
/** Monthly amount needed to reach a target (cents), or 0 if the start value alone gets there. */
export function monthlyNeeded(targetCents: number, startCents: number, years: number, annualRate: number): number {
  const base = projectValue(startCents, 0, years, annualRate); if (base >= targetCents) return 0;
  const per = projectValue(0, 100, years, annualRate); return Math.ceil(((targetCents - base) / per) * 100);
}
