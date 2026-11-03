// Maps the app's State to the Postgres tables and back. The pure engine does all the money maths; this file
// only loads and persists. Always run it inside a transaction that holds the per-user lock (see withUser).
import type { Store } from '@/lib/data';
import { emptyState } from '@/lib/engine';
import { BUILTIN_PLAYLISTS } from '@/lib/seed';
import type { Db, Pool } from './db';
import type { State } from '@/lib/types';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
export class PgStore implements Store {
  private knownOrders = new Set<string>();
  constructor(private db: Db, private userId: string) {}

  async load(): Promise<State | null> {
    const q = <T,>(sql: string, p: unknown[] = [this.userId]) => this.db.query<T>(sql, p).then((r) => r.rows);
    const [p] = await q<any>(`select display_name, birth_year, risk_tolerance, horizon_years, goals, questionnaire_step, onboarded_on::text, timezone from profiles where user_id = $1`);
    if (!p) return null;
    const s = emptyState(p.timezone);
    s.profile = { displayName: p.display_name, birthYear: p.birth_year, riskTolerance: p.risk_tolerance, horizonYears: p.horizon_years, goals: p.goals ?? [], step: p.questionnaire_step, onboardedAt: p.onboarded_on, timezone: p.timezone };
    const [a] = await q<any>(`select a.cash_cents::float8 as cash, a.net_deposits_cents::float8 as net, a.rebalance_enabled, a.last_jobs_on::text as last_jobs, mp.slug from accounts a left join model_portfolios mp on mp.id = a.model_portfolio_id where a.user_id = $1`);
    if (a) { s.account = { cashCents: a.cash, netDepositsCents: a.net, modelId: a.slug, rebalanceEnabled: a.rebalance_enabled }; s.lastJobsOn = a.last_jobs; }
    s.holdings = (await q<any>(`select i.ticker, h.qty::float8 as qty, h.cost_basis_cents::float8 as cost from holdings h join instruments i on i.id = h.instrument_id where h.user_id = $1 order by i.ticker`)).map((r) => ({ ticker: r.ticker, qty: r.qty, costBasisCents: r.cost }));
    s.contributions = (await q<any>(`select id, amount_cents::float8 as amount, frequency, day_of_week, day_of_month, next_run_on::text as next, status from contributions where user_id = $1 order by created_at, id`)).map((r) => ({ id: r.id, amountCents: r.amount, frequency: r.frequency, dayOfWeek: r.day_of_week, dayOfMonth: r.day_of_month, nextRunOn: r.next, status: r.status }));
    s.orders = (await q<any>(`select o.id, o.kind, i.ticker, o.qty::float8 as qty, o.price::float8 as price, o.amount_cents::float8 as amount, o.contribution_id, o.run_for::text as run_for, o.trade_date::text as date, o.note
      from orders o left join instruments i on i.id = o.instrument_id where o.user_id = $1 order by o.trade_date, o.seq`)).map((r) => {
      const o: any = { id: r.id, kind: r.kind, amountCents: r.amount, date: r.date, note: r.note };
      if (r.ticker) { o.ticker = r.ticker; o.qty = r.qty; o.price = r.price; } if (r.contribution_id) o.contributionId = r.contribution_id; if (r.run_for) o.runFor = r.run_for; return o; });
    this.knownOrders = new Set(s.orders.map((o) => o.id));
    s.goals = (await q<any>(`select id, name, target_amount_cents::float8 as t, target_year from goals where user_id = $1 order by created_at, id`)).map((r) => ({ id: r.id, name: r.name, targetCents: r.t, targetYear: r.target_year }));
    const own = await q<any>(`select id, name, theme, description, is_public from playlists where owner_id = $1 order by created_at, id`);
    const items = await q<any>(`select pi.playlist_id, i.ticker, pi.weight_bps from playlist_items pi join instruments i on i.id = pi.instrument_id join playlists p on p.id = pi.playlist_id where p.owner_id = $1 order by i.ticker`);
    s.playlists = [...BUILTIN_PLAYLISTS.map((b) => ({ ...b, items: b.items.map((x) => ({ ...x })) })), ...own.map((r) => ({ id: r.id, owner: 'me' as const, name: r.name, theme: r.theme, description: r.description, isPublic: r.is_public, items: items.filter((i) => i.playlist_id === r.id).map((i) => ({ ticker: i.ticker, weightBps: i.weight_bps })) }))];
    s.playlistInvestments = (await q<any>(`select playlist_ref, amount_cents::float8 as amount, invested_on::text as d from playlist_investments where user_id = $1 order by seq`)).map((r) => ({ playlistId: r.playlist_ref, amountCents: r.amount, date: r.d }));
    s.chat = (await q<any>(`select id, role, content, kind, sent_on::text as d from chat_messages where user_id = $1 order by seq`)).map((r) => ({ id: r.id, role: r.role, content: r.content, kind: r.kind, date: r.d }));
    const [n] = await q<any>(`select daily_briefing, contribution_done, rebalance_done from notification_prefs where user_id = $1`);
    if (n) s.prefs = { dailyBriefing: n.daily_briefing, contributionDone: n.contribution_done, rebalanceDone: n.rebalance_done };
    s.inbox = (await q<any>(`select id, kind, title, body, notice_date::text as d, read from notifications where user_id = $1 order by seq`)).map((r) => ({ id: r.id, kind: r.kind, title: r.title, text: r.body, date: r.d, read: r.read }));
    return s;
  }

  async save(s: State): Promise<void> {
    const u = this.userId; const db = this.db; const x = (sql: string, p: unknown[]) => db.query(sql, p);
    const pr = s.profile;
    await x(`insert into profiles (user_id, display_name, birth_year, risk_tolerance, horizon_years, goals, questionnaire_step, onboarded_on, timezone)
      values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
      on conflict (user_id) do update set display_name=$2, birth_year=$3, risk_tolerance=$4, horizon_years=$5, goals=$6::jsonb, questionnaire_step=$7, onboarded_on=$8, timezone=$9, updated_at=now()`,
      [u, pr.displayName, pr.birthYear, pr.riskTolerance, pr.horizonYears, JSON.stringify(pr.goals), pr.step, pr.onboardedAt, pr.timezone]);
    const ac = s.account;
    await x(`insert into accounts (user_id, model_portfolio_id, cash_cents, net_deposits_cents, rebalance_enabled, last_jobs_on)
      values ($1,(select id from model_portfolios where slug = $2),$3,$4,$5,$6)
      on conflict (user_id) do update set model_portfolio_id=(select id from model_portfolios where slug = $2), cash_cents=$3, net_deposits_cents=$4, rebalance_enabled=$5, last_jobs_on=$6, updated_at=now()`,
      [u, ac.modelId, ac.cashCents, ac.netDepositsCents, ac.rebalanceEnabled, s.lastJobsOn]);
    const [{ id: accountId }] = (await x('select id from accounts where user_id = $1', [u])).rows;

    await x('delete from holdings where user_id = $1', [u]);
    for (const h of s.holdings) await x(`insert into holdings (account_id, user_id, instrument_id, qty, cost_basis_cents) select $1,$2,id,$4,$5 from instruments where ticker = $3`, [accountId, u, h.ticker, h.qty, h.costBasisCents]);

    const cIds = s.contributions.map((c) => c.id);
    await x('delete from contributions where user_id = $1 and id <> all($2::uuid[])', [u, cIds]);
    for (const c of s.contributions) await x(`insert into contributions (id, user_id, account_id, amount_cents, frequency, day_of_week, day_of_month, next_run_on, status)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (id) do update set amount_cents=$4, frequency=$5, day_of_week=$6, day_of_month=$7, next_run_on=$8, status=$9, updated_at=now()`,
      [c.id, u, accountId, c.amountCents, c.frequency, c.dayOfWeek, c.dayOfMonth, c.nextRunOn, c.status]);

    await x('delete from orders where user_id = $1 and id <> all($2::uuid[])', [u, s.orders.map((o) => o.id)]);
    for (const o of s.orders) {
      if (this.knownOrders.has(o.id)) continue;               // orders are append-only: never rewrite history
      await x(`insert into orders (id, user_id, account_id, instrument_id, contribution_id, kind, qty, price, amount_cents, run_for, trade_date, note)
        values ($1,$2,$3,(select id from instruments where ticker = $4),$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.id, u, accountId, o.ticker ?? null, o.contributionId ?? null, o.kind, o.qty ?? null, o.price ?? null, o.amountCents, o.runFor ?? null, o.date, o.note]);
      this.knownOrders.add(o.id);
    }

    await x('delete from goals where user_id = $1 and id <> all($2::uuid[])', [u, s.goals.map((g) => g.id)]);
    for (const g of s.goals) await x(`insert into goals (id, user_id, name, target_amount_cents, target_year) values ($1,$2,$3,$4,$5)
      on conflict (id) do update set name=$3, target_amount_cents=$4, target_year=$5, updated_at=now()`, [g.id, u, g.name, g.targetCents, g.targetYear]);

    const mine = s.playlists.filter((p) => p.owner === 'me');
    await x('delete from playlists where owner_id = $1 and id <> all($2::uuid[])', [u, mine.map((p) => p.id)]);
    for (const p of mine) {
      await x(`insert into playlists (id, owner_id, name, theme, description, is_public) values ($1,$2,$3,$4,$5,$6)
        on conflict (id) do update set name=$3, theme=$4, description=$5, is_public=$6, updated_at=now()`, [p.id, u, p.name, p.theme, p.description, p.isPublic]);
      await x('delete from playlist_items where playlist_id = $1', [p.id]);
      for (const i of p.items) await x('insert into playlist_items (playlist_id, instrument_id, weight_bps) select $1, id, $3 from instruments where ticker = $2', [p.id, i.ticker, i.weightBps]);
    }
    await x('delete from playlist_investments where user_id = $1', [u]);
    for (const i of s.playlistInvestments) await x('insert into playlist_investments (user_id, playlist_ref, amount_cents, invested_on) values ($1,$2,$3,$4)', [u, i.playlistId, i.amountCents, i.date]);

    let [t] = (await x('select id from chat_threads where user_id = $1 order by created_at limit 1', [u])).rows;
    if (!t) t = (await x('insert into chat_threads (user_id) values ($1) returning id', [u])).rows[0];
    await x('delete from chat_messages where user_id = $1 and id <> all($2::uuid[])', [u, s.chat.map((m) => m.id)]);
    for (const m of s.chat) await x('insert into chat_messages (id, thread_id, user_id, role, content, kind, sent_on) values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing', [m.id, t.id, u, m.role, m.content, m.kind, m.date]);

    await x('delete from notifications where user_id = $1 and id <> all($2::uuid[])', [u, s.inbox.map((n) => n.id)]);
    for (const n of s.inbox) await x(`insert into notifications (id, user_id, kind, title, body, notice_date, read) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (id) do update set read = $7`, [n.id, u, n.kind, n.title, n.text, n.date, n.read]);
    await x(`insert into notification_prefs (user_id, daily_briefing, contribution_done, rebalance_done) values ($1,$2,$3,$4)
      on conflict (user_id) do update set daily_briefing=$2, contribution_done=$3, rebalance_done=$4, updated_at=now()`, [u, s.prefs.dailyBriefing, s.prefs.contributionDone, s.prefs.rebalanceDone]);
    await x('insert into memberships (user_id) values ($1) on conflict (user_id) do nothing', [u]);
  }

  async clear(): Promise<void> {
    for (const t of ['notifications', 'chat_messages', 'chat_threads', 'playlist_investments', 'playlists', 'goals', 'orders', 'contributions', 'holdings', 'accounts', 'notification_prefs', 'memberships', 'profiles'])
      await this.db.query(`delete from ${t} where ${t === 'playlists' ? 'owner_id' : 'user_id'} = $1`, [this.userId]);
    this.knownOrders.clear();
  }
}

/** One user's whole request runs in one transaction under a per-user lock, so two requests can never interleave. */
export async function withUser<T>(pool: Pool, userId: string, fn: (store: PgStore) => Promise<T>): Promise<T> {
  return pool.tx(async (db) => { await db.query('select pg_advisory_xact_lock(hashtext($1))', [userId]); return fn(new PgStore(db, userId)); });
}
/** Deletes the sign-in user; every table cascades from auth.users. */
export async function deleteAccount(pool: Pool, userId: string): Promise<void> { await pool.query('delete from auth.users where id = $1', [userId]); }
export { ZERO_UUID };
