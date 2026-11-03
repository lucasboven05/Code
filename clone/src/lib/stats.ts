// Plain-words figures about an investment, computed from its (simulated) price history.
export type Stats = { high: number; low: number; changePct: number; swingPct: number; worstFallPct: number; swing: 'calm' | 'moderate' | 'wild'; days: number };

/** closes: oldest first. Needs at least 30 prices. */
export function stockStats(closes: number[]): Stats | null {
  if (closes.length < 30 || closes.some((c) => !(c > 0) || !Number.isFinite(c))) return null;
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const swingPct = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1)) * 100;   // typical size of a one-day move
  let peak = closes[0], worst = 0; for (const c of closes) { peak = Math.max(peak, c); worst = Math.min(worst, c / peak - 1); }
  return { high: Math.max(...closes), low: Math.min(...closes), changePct: (closes[closes.length - 1] / closes[0] - 1) * 100, swingPct, worstFallPct: worst * 100,
    swing: swingPct < 0.6 ? 'calm' : swingPct < 1.5 ? 'moderate' : 'wild', days: closes.length };
}
const SWING_TEXT = { calm: 'It moves very little from day to day.', moderate: 'It moves a fair amount from day to day.', wild: 'It can swing a lot in a single day. Expect a bumpy ride.' };
export const swingText = (s: Stats['swing']) => SWING_TEXT[s];
export function drivers(type: string): string {
  if (type === 'etf') return 'A fund moves with everything inside it. Stock funds follow company profits and the economy. Bond funds follow interest rates and worries about borrowers. Because it holds many things, one bad company matters less.';
  if (type === 'stock') return 'A single company moves with its own results, its customers, its competitors and the mood of the market. With only one company inside, good or bad news about it moves the price far more than it would move a fund.';
  return 'A digital coin has no company or profits behind it, so its price mostly follows how many people want it. That makes it swing much harder than funds or companies.';
}
