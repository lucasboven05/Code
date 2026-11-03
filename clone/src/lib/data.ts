// The data layer. Screens only talk to the DataLayer interface. LocalData keeps everything in this browser.
// The real version (Supabase + server actions, see replica/architecture.md) implements the same methods,
// so swapping it in changes no screen code.
import type { ChatMessage, Contribution, Frequency, Goal, ModelPortfolio, Order, Playlist, Profile, State } from './types';
import { BPS, buyBasket, deposit, emptyState, firstRun, matchPortfolio, runJobs, totalValueCents, valueSeries } from './engine';
import { addDays, isTradingDay, prevTradingDay, todayIn } from './calendar';
import { INSTRUMENTS, MODELS } from './seed';
import { priceAt, range } from './prices';
import { allieReply, weeklyRecap, type AllieContext } from './allie';

export type HoldingRow = { ticker: string; name: string; qty: number; valueCents: number; weight: number; dayChange: number; gainCents: number };
export type HomeView = { today: string; valueCents: number; cashCents: number; netDepositsCents: number; dayChangeCents: number; rows: HoldingRow[]; plan: ModelPortfolio | null; contributions: Contribution[]; hasHistory: boolean };
export type PracticeStart = 'today' | '6m' | '1y';

export interface DataLayer {
  load(): Promise<State>;
  today(): string;
  saveProfile(patch: Partial<Profile>): Promise<State>;
  matchedPortfolio(): ModelPortfolio;
  completeOnboarding(a: { amountCents: number; frequency: Frequency; dayOfWeek: number | null; dayOfMonth: number | null; start: PracticeStart }): Promise<State>;
  updateContribution(id: string, patch: Partial<Pick<Contribution, 'amountCents' | 'status'>>): Promise<State>;
  home(): HomeView;
  series(range: '1W' | '1M' | '3M' | '1Y' | 'All'): { date: string; valueCents: number; netDepositsCents: number }[];
  stock(ticker: string): { ticker: string; name: string; blurb: string; type: string; priceCents: number; dayChange: number; points: { date: string; close: number }[]; held: HoldingRow | null };
  createPlaylist(p: Omit<Playlist, 'id' | 'owner'>): Promise<State>;
  updatePlaylist(id: string, p: Partial<Omit<Playlist, 'id' | 'owner'>>): Promise<State>;
  deletePlaylist(id: string): Promise<State>;
  investInPlaylist(id: string, amountCents: number): Promise<State>;
  addMoney(amountCents: number): Promise<State>;
  saveGoal(g: Omit<Goal, 'id'> & { id?: string }): Promise<State>;
  deleteGoal(id: string): Promise<State>;
  sendChat(text: string): Promise<State>;
  addRecap(): Promise<State>;
  setPrefs(patch: Partial<State['prefs']>): Promise<State>;
  setRebalance(on: boolean): Promise<State>;
  setTimezone(tz: string): Promise<State>;
  resetAccount(): Promise<State>;
  deleteEverything(): Promise<State>;
}

export const LOCAL_KEY = 'alinea-style-clone.v1';
/** Where a user's State lives. The browser uses localStorage; the server uses Postgres. */
export interface Store { load(): Promise<State | null>; save(s: State): Promise<void>; clear(): Promise<void> }
export type AllieFn = (question: string, ctx: AllieContext) => Promise<string>;
const scriptedAllie: AllieFn = async (q, ctx) => allieReply(q, ctx);
const rid = (s: State, _p: string) => { s.seq += 1; return globalThis.crypto.randomUUID(); };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export class Service implements DataLayer {
  state: State = emptyState();
  now: () => Date;
  constructor(protected store: Store, now: () => Date = () => new Date(), protected allie: AllieFn = scriptedAllie) { this.now = now; }
  protected defaultTimezone() { return 'America/Panama'; }
  today() { return todayIn(this.state.profile.timezone, this.now()); }
  protected async save(s: State) { await this.store.save(s); this.state = s; return s; }
  private jobs(s: State) { return runJobs(s, this.today(), priceAt); }

  async load() {
    const s = await this.store.load();
    this.state = s ?? emptyState(this.defaultTimezone());
    if (this.state.profile.onboardedAt) await this.save(this.jobs(this.state));
    return this.state;
  }
  async saveProfile(patch: Partial<Profile>) { const s = clone(this.state); s.profile = { ...s.profile, ...patch }; return this.save(s); }
  matchedPortfolio() { return matchPortfolio(this.state.profile); }

  async completeOnboarding(a: { amountCents: number; frequency: Frequency; dayOfWeek: number | null; dayOfMonth: number | null; start: PracticeStart }) {
    const today = this.today(); const back = a.start === '6m' ? 182 : a.start === '1y' ? 365 : 0;
    let startDate = addDays(today, -back); if (startDate < '2025-01-06') startDate = '2025-01-06';
    let s = clone(this.state); const model = this.matchedPortfolio();
    s.account.modelId = model.id; s.profile.onboardedAt = startDate;
    const c: Contribution = { id: rid(s, 'c'), amountCents: a.amountCents, frequency: a.frequency, dayOfWeek: a.dayOfWeek, dayOfMonth: a.dayOfMonth, nextRunOn: null, status: 'active' };
    c.nextRunOn = firstRun(c, startDate); s.contributions.push(c);
    s.lastJobsOn = addDays(startDate, -1);              // practice start: replay the plan from that day at that day's prices
    return this.save(this.jobs(s));
  }
  async updateContribution(id: string, patch: Partial<Pick<Contribution, 'amountCents' | 'status'>>) {
    const s = clone(this.state); const c = s.contributions.find((x) => x.id === id); if (!c) throw new Error('Plan not found');
    if (patch.amountCents !== undefined) { if (!Number.isInteger(patch.amountCents) || patch.amountCents <= 0) throw new Error('Enter an amount above zero'); c.amountCents = patch.amountCents; }
    if (patch.status) { c.status = patch.status; if (patch.status === 'active' && !c.nextRunOn) c.nextRunOn = firstRun(c, this.today()); }
    return this.save(s);
  }

  private rows(date: string): HoldingRow[] {
    const prev = prevTradingDay(addDays(date, -1)); const total = this.state.holdings.reduce((t, h) => t + h.qty * priceAt(h.ticker, date), 0);
    return this.state.holdings.map((h) => {
      const p = priceAt(h.ticker, date); const v = Math.round(h.qty * p * 100);
      return { ticker: h.ticker, name: INSTRUMENTS.find((i) => i.ticker === h.ticker)?.name ?? h.ticker, qty: h.qty, valueCents: v, weight: total > 0 ? (h.qty * p) / total : 0, dayChange: p / priceAt(h.ticker, prev) - 1, gainCents: v - h.costBasisCents };
    }).sort((a, b) => b.valueCents - a.valueCents);
  }
  home(): HomeView {
    const today = this.today(); const asOf = prevTradingDay(today); const prev = prevTradingDay(addDays(asOf, -1));
    const value = totalValueCents(this.state, asOf, priceAt);
    const prevValue = this.state.holdings.reduce((t, h) => t + h.qty * priceAt(h.ticker, prev) * 100, this.state.account.cashCents);
    return { today: asOf, valueCents: value, cashCents: this.state.account.cashCents, netDepositsCents: this.state.account.netDepositsCents, dayChangeCents: Math.round(value - prevValue),
      rows: this.rows(asOf), plan: MODELS.find((m) => m.id === this.state.account.modelId) ?? null, contributions: this.state.contributions,
      hasHistory: new Set(this.state.orders.map((o) => o.date)).size > 1 };
  }
  series(r: '1W' | '1M' | '3M' | '1Y' | 'All') {
    const asOf = prevTradingDay(this.today()); const first = this.state.orders[0]?.date ?? asOf;
    const days = { '1W': 7, '1M': 30, '3M': 91, '1Y': 365, All: 4000 }[r]; let from = addDays(asOf, -days); if (from < first) from = first;
    const dates: string[] = []; for (let d = from; d <= asOf; d = addDays(d, 1)) if (isTradingDay(d)) dates.push(d);
    return valueSeries(this.state, dates, priceAt);
  }
  stock(ticker: string) {
    const inst = INSTRUMENTS.find((i) => i.ticker === ticker); if (!inst) throw new Error('Unknown ticker');
    const asOf = prevTradingDay(this.today()); const prev = prevTradingDay(addDays(asOf, -1));
    return { ticker, name: inst.name, blurb: inst.blurb, type: inst.type, priceCents: Math.round(priceAt(ticker, asOf) * 100), dayChange: priceAt(ticker, asOf) / priceAt(ticker, prev) - 1,
      points: range(ticker, addDays(asOf, -365), asOf), held: this.rows(asOf).find((r) => r.ticker === ticker) ?? null };
  }

  async createPlaylist(p: Omit<Playlist, 'id' | 'owner'>) {
    if (!p.name.trim()) throw new Error('Give your playlist a name');
    if (p.items.reduce((t, i) => t + i.weightBps, 0) !== BPS) throw new Error('Weights must total 100%');
    const s = clone(this.state); s.playlists.push({ ...p, name: p.name.trim(), id: rid(s, 'p'), owner: 'me' }); return this.save(s);
  }
  async updatePlaylist(id: string, p: Partial<Omit<Playlist, 'id' | 'owner'>>) {
    const s = clone(this.state); const pl = s.playlists.find((x) => x.id === id && x.owner === 'me'); if (!pl) throw new Error('You can only edit your own playlists');
    const next = { ...pl, ...p }; if (next.items.reduce((t, i) => t + i.weightBps, 0) !== BPS) throw new Error('Weights must total 100%');
    Object.assign(pl, next); return this.save(s);
  }
  async deletePlaylist(id: string) { const s = clone(this.state); s.playlists = s.playlists.filter((p) => !(p.id === id && p.owner === 'me')); return this.save(s); }

  private requireTrading(): string { const d = this.today(); return isTradingDay(d) ? d : prevTradingDay(d); }
  async addMoney(amountCents: number) { const d = this.requireTrading(); return this.save(deposit(clone(this.state), amountCents, d, { note: 'Practice deposit' })); }
  async investInPlaylist(id: string, amountCents: number) {
    const pl = this.state.playlists.find((p) => p.id === id); if (!pl) throw new Error('Playlist not found');
    if (!this.state.profile.onboardedAt) throw new Error('Finish setup first');
    const d = this.requireTrading(); let s = deposit(clone(this.state), amountCents, d, { note: 'For ' + pl.name });
    s = buyBasket(s, amountCents, pl.items, d, priceAt, { note: pl.name });
    s.playlistInvestments.push({ playlistId: id, amountCents, date: d }); return this.save(s);
  }
  async saveGoal(g: Omit<Goal, 'id'> & { id?: string }) {
    if (!g.name.trim() || g.targetCents <= 0) throw new Error('Add a name and an amount');
    const s = clone(this.state); const ex = g.id ? s.goals.find((x) => x.id === g.id) : null;
    if (ex) Object.assign(ex, { name: g.name.trim(), targetCents: g.targetCents, targetYear: g.targetYear }); else s.goals.push({ id: rid(s, 'g'), name: g.name.trim(), targetCents: g.targetCents, targetYear: g.targetYear });
    return this.save(s);
  }
  async deleteGoal(id: string) { const s = clone(this.state); s.goals = s.goals.filter((g) => g.id !== id); return this.save(s); }
  async sendChat(text: string) {
    const t = text.trim(); if (!t) throw new Error('Type a question first');
    const s = clone(this.state); const date = this.today();
    const msg = (role: ChatMessage['role'], content: string, kind: ChatMessage['kind'] = 'chat'): ChatMessage => ({ id: rid(s, 'm'), role, content, kind, date });
    const q = t.slice(0, 500); const reply = await this.allie(q, { state: s, today: date });
    s.chat.push(msg('user', q)); s.chat.push(msg('assistant', reply)); return this.save(s);
  }
  async addRecap() { const s = clone(this.state); const date = this.today(); s.chat.push({ id: rid(s, 'm'), role: 'assistant', content: weeklyRecap({ state: s, today: date }), kind: 'recap', date }); return this.save(s); }
  async setPrefs(patch: Partial<State['prefs']>) { const s = clone(this.state); s.prefs = { ...s.prefs, ...patch }; return this.save(s); }
  async setRebalance(on: boolean) { const s = clone(this.state); s.account.rebalanceEnabled = on; return this.save(s); }
  async setTimezone(tz: string) { const s = clone(this.state); s.profile.timezone = tz; return this.save(s); }
  async resetAccount() { const s = emptyState(this.state.profile.timezone); s.profile.displayName = this.state.profile.displayName; s.playlists = [...s.playlists, ...this.state.playlists.filter((p) => p.owner === 'me')]; return this.save(s); }
  async deleteEverything() { await this.store.clear(); this.state = emptyState(this.state.profile.timezone); return this.state; }
}

/** Browser-only storage (the original, offline mode). */
export class LocalStorageStore implements Store {
  async load() { try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) { const p = JSON.parse(raw); if (p?.v === 1) return p as State; } } catch { /* ignore */ } return null; }
  async save(s: State) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch { /* storage may be blocked: stay in memory */ } }
  async clear() { try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ } }
}
export class LocalData extends Service {
  constructor(now: () => Date = () => new Date()) { super(new LocalStorageStore(), now); }
  protected defaultTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Panama'; }
}

export type { Order };
