export const usd = (cents: number, opts: { sign?: boolean } = {}) => {
  const v = Math.abs(cents) / 100; const s = v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return opts.sign ? (cents < 0 ? '-' : '+') + s : cents < 0 ? '-' + s : s;
};
export const pct = (x: number, digits = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(digits) + '%';
export const qtyFmt = (q: number) => (Math.round(q * 1e6) / 1e6).toString();
export const dateFmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const MONEY_MIN_CENTS = 100, MONEY_MAX_CENTS = 10_000_000;
/** For money fields: the amount in cents, or the message to show next to the field. Same limits as the server. */
export function parseMoney(text: string): { ok: true; cents: number } | { ok: false; error: string } {
  const c = toCents(text); if (c == null) return { ok: false, error: 'Enter an amount above zero.' };
  if (c < MONEY_MIN_CENTS || c > MONEY_MAX_CENTS) return { ok: false, error: 'Enter an amount between $1.00 and $100,000.00.' };
  return { ok: true, cents: c };
}
/** Parses what a person types as a dollar amount. Accepts 12, 12.5, 12.50, $1,000.50. Rejects anything ambiguous: spaces inside the number, misplaced commas, exponents, non-ASCII digits, more than 2 decimals. */
export const toCents = (text: string): number | null => {
  const t = text.trim(); if (!/^\$?\s?(\d{1,3}(,\d{3})+|\d+)(\.\d{0,2})?$/.test(t)) return null;
  const c = Math.round(parseFloat(t.replace(/[$,\s]/g, '')) * 100); return Number.isFinite(c) && c > 0 ? c : null;
};
