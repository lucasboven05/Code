// SIMULATED prices: a seeded random walk per instrument, so every reload shows the same history.
// Swap this module for a real market-data provider (see replica/architecture.md) without touching screens.
import { INSTRUMENTS } from './seed';
import { addDays, isTradingDay } from './calendar';
import type { PriceAt } from './types';

const START = '2025-01-02';
const END = '2027-12-31';
function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Series = { dates: string[]; closes: number[] };
const cache = new Map<string, Series>();
function build(ticker: string): Series {
  const inst = INSTRUMENTS.find((i) => i.ticker === ticker);
  if (!inst) throw new Error('Unknown ticker ' + ticker);
  const r = rng(hash(ticker)); const dates: string[] = []; const closes: number[] = [];
  let p = inst.base;
  for (let d = START; d <= END; d = addDays(d, 1)) {
    if (!isTradingDay(d)) continue;
    const z = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    p = p * Math.exp(inst.mu / 252 - (inst.sigma ** 2) / 504 + (inst.sigma / Math.sqrt(252)) * z);
    dates.push(d); closes.push(Math.round(p * 10000) / 10000);
  }
  return { dates, closes };
}
export function series(ticker: string): Series { let s = cache.get(ticker); if (!s) { s = build(ticker); cache.set(ticker, s); } return s; }

/** Last close on or before `date`. */
export const priceAt: PriceAt = (ticker, date) => {
  const s = series(ticker); let lo = 0, hi = s.dates.length - 1, ans = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (s.dates[mid] <= date) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return s.closes[ans];
};
export function range(ticker: string, from: string, to: string): { date: string; close: number }[] {
  const s = series(ticker); const out: { date: string; close: number }[] = [];
  s.dates.forEach((d, i) => { if (d >= from && d <= to) out.push({ date: d, close: s.closes[i] }); });
  return out;
}
