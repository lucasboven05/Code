export const usd = (cents: number, opts: { sign?: boolean } = {}) => {
  const v = Math.abs(cents) / 100; const s = v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return opts.sign ? (cents < 0 ? '-' : '+') + s : cents < 0 ? '-' + s : s;
};
export const pct = (x: number, digits = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(digits) + '%';
export const qtyFmt = (q: number) => (Math.round(q * 1e6) / 1e6).toString();
export const dateFmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const toCents = (text: string): number | null => {
  const t = text.replace(/[$,\s]/g, ''); if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const c = Math.round(parseFloat(t) * 100); return c > 0 ? c : null;
};
