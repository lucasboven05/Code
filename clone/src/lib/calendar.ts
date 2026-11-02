// US market calendar. 2026-2027 holidays and early closes: NYSE published calendar (as recorded in the
// trader-alerts skill, read 2026-10-13). 2025 holidays added from the public NYSE calendar.
// Outside 2025-2027 only weekends are treated as closed (calendarKnown() says so).
const HOLIDAYS = new Set([
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
export const EARLY_CLOSES = new Set(['2025-07-03', '2025-11-28', '2025-12-24', '2026-11-27', '2026-12-24', '2027-11-26']);

export const toDate = (s: string) => new Date(s + 'T00:00:00Z');
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * 86400000));
export const weekday = (s: string) => toDate(s).getUTCDay(); // 0 = Sunday
export const isTradingDay = (s: string) => { const w = weekday(s); return w >= 1 && w <= 5 && !HOLIDAYS.has(s); };
export const calendarKnown = (s: string) => s >= '2025-01-01' && s <= '2027-12-31';
export function nextTradingDay(s: string): string { let d = s; while (!isTradingDay(d)) d = addDays(d, 1); return d; }
export function prevTradingDay(s: string): string { let d = s; while (!isTradingDay(d)) d = addDays(d, -1); return d; }
/** Calendar date "today" in an IANA time zone, as YYYY-MM-DD. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function addMonths(s: string, n: number, dom: number): string {
  const d = toDate(s); const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  return iso(new Date(Date.UTC(y, m, Math.min(dom, 28))));
}
