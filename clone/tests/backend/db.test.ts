import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { Service } from '@/lib/data';
import { MODELS } from '@/lib/seed';
import type { Pool } from '@/server/db';
import { migrate } from '@/server/migrate';
import { deleteAccount, withUser } from '@/server/pgstore';
import { addUser, asUser, makeDb, NOW } from './helpers';

let pg: PGlite, pool: Pool, A: string, B: string;
const norm = (s: any) => { const c = JSON.parse(JSON.stringify(s)); delete c.seq; c.holdings.sort((a: any, b: any) => a.ticker.localeCompare(b.ticker)); c.playlists.forEach((p: any) => p.items.sort((a: any, b: any) => a.ticker.localeCompare(b.ticker))); return c; };
async function setup(uid: string, name: string) {
  return withUser(pool, uid, async (store) => {
    const svc = new Service(store, NOW); await svc.load();
    await svc.saveProfile({ riskTolerance: 4, horizonYears: 8, goals: ['A first home'], birthYear: 1995, displayName: name, step: 5 });
    await svc.completeOnboarding({ amountCents: 7500, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 5, start: '6m' });
    await svc.investInPlaylist('p-clean', 4000);
    await svc.saveGoal({ name: 'A deposit', targetCents: 2_500_000, targetYear: 2032 });
    await svc.createPlaylist({ name: 'Calm mix', theme: 'Income', description: 'x', isPublic: false, items: [{ ticker: 'S-US', weightBps: 6000 }, { ticker: 'S-BND', weightBps: 4000 }] });
    await svc.sendChat('What is an ETF?');
    return svc.state;
  });
}
beforeAll(async () => { ({ pg, pool } = await makeDb()); A = await addUser(pool); B = await addUser(pool); }, 60_000);

describe('migrations', () => {
  it('apply cleanly, only once', async () => { expect(await migrate(pool)).toEqual([]); const n = (await pool.query('select count(*)::int as n from schema_migrations')).rows[0].n; expect(n).toBe(2); });
  it('seed the reference tables and every sample portfolio totals 100%', async () => {
    const r = await pool.query('select mp.slug, sum(a.weight_bps)::int as w from model_portfolios mp join model_portfolio_allocations a on a.model_portfolio_id = mp.id group by mp.slug');
    expect(r.rows.length).toBe(MODELS.length); for (const x of r.rows) expect(x.w).toBe(10000);
  });
});

describe('state round trip through Postgres', () => {
  it('what is saved is exactly what is loaded', async () => {
    const before = await setup(A, 'Sam');
    const after = await withUser(pool, A, (store) => new Service(store, NOW).load());
    expect(norm(after)).toEqual(norm(before));
    expect(after.inbox.length, 'notices are stored and loaded').toBeGreaterThan(0); expect(after.inbox.every((n) => n.read === false)).toBe(true);
    expect(after.orders.length).toBeGreaterThan(6); expect(after.chat.map((m) => m.role)).toEqual(['user', 'assistant']);
  });
  it('loading again does not rewrite history or duplicate orders', async () => {
    const n = async () => (await pool.query('select count(*)::int as n from orders where user_id = $1', [A])).rows[0].n;
    const c1 = await n(); await withUser(pool, A, (store) => new Service(store, NOW).load()); expect(await n()).toBe(c1);
  });
});

describe('database rules', () => {
  it('a scheduled run cannot be booked twice, deposits included', async () => {
    const [d] = (await pool.query('select account_id, contribution_id, run_for::text as run_for, trade_date::text as td from orders where user_id = $1 and kind = $2 and contribution_id is not null limit 1', [A, 'deposit'])).rows;
    await expect(pool.query(`insert into orders (user_id, account_id, kind, amount_cents, contribution_id, run_for, trade_date) values ($1,$2,'deposit',100,$3,$4,$5)`, [A, d.account_id, d.contribution_id, d.run_for, d.td])).rejects.toThrow(/orders_contribution_once|duplicate key/);
  });
  it('rejects impossible values', async () => {
    await expect(pool.query('update accounts set cash_cents = -1 where user_id = $1', [A])).rejects.toThrow();
    await expect(pool.query(`insert into contributions (user_id, account_id, amount_cents, frequency) select user_id, id, 0, 'monthly' from accounts where user_id = $1`, [A])).rejects.toThrow();
    await expect(pool.query(`update orders set qty = 0 where user_id = $1 and kind = 'buy'`, [A])).rejects.toThrow();
  });
  it('playlist weights must total 100% when the transaction commits', async () => {
    const mk = (w1: number, w2: number) => pool.tx(async (db) => {
      const p = (await db.query<{ id: string }>(`insert into playlists (owner_id, name) values ($1, 'x') returning id`, [A])).rows[0].id;
      await db.query(`insert into playlist_items (playlist_id, instrument_id, weight_bps) select $1, id, $3 from instruments where ticker = $2`, [p, 'S-US', w1]);
      await db.query(`insert into playlist_items (playlist_id, instrument_id, weight_bps) select $1, id, $3 from instruments where ticker = $2`, [p, 'S-BND', w2]);
    });
    await expect(mk(5000, 4000)).rejects.toThrow(/must be 10000/); await expect(mk(5000, 5000)).resolves.toBeUndefined();
  });
});

describe('a second user sees and changes nothing of the first user', () => {
  it('row level security: browser role reads only its own rows', async () => {
    await setup(B, 'Robin');
    const mineA = await asUser(pg, A, async () => ({
      accounts: (await pg.query('select user_id from accounts')).rows, orders: (await pg.query('select distinct user_id from orders')).rows, goals: (await pg.query('select user_id from goals')).rows,
      chat: (await pg.query('select distinct user_id from chat_messages')).rows, notices: (await pg.query('select distinct user_id from notifications')).rows, holdings: (await pg.query('select distinct user_id from holdings')).rows, playlists: (await pg.query('select owner_id from playlists where owner_id is not null')).rows,
      instruments: (await pg.query('select 1 from instruments')).rows.length,
    }));
    expect(mineA.accounts).toEqual([{ user_id: A }]); expect(mineA.orders).toEqual([{ user_id: A }]); expect(mineA.goals).toEqual([{ user_id: A }]);
    expect(mineA.chat).toEqual([{ user_id: A }]); expect(mineA.notices).toEqual([{ user_id: A }]); expect(mineA.holdings).toEqual([{ user_id: A }]); expect(mineA.instruments).toBeGreaterThan(10);
    for (const p of mineA.playlists as any[]) expect(p.owner_id).toBe(A);
    const spy = await asUser(pg, A, async () => ((await pg.query('select count(*)::int as n from orders where user_id = $1', [B])).rows[0] as { n: number }).n);
    expect(spy).toBe(0);
  });
  it('the browser role cannot write at all, to its own rows or anyone else\'s', async () => {
    const attempts = ["update accounts set cash_cents = 999999999", "delete from orders", "insert into goals (user_id, name, target_amount_cents, target_year) values ('" + A + "','x',100,2030)", "update profiles set display_name = 'hacked'", "delete from chat_messages", "update notifications set read = true", "insert into notifications (user_id, kind, title, body, notice_date) values ('" + A + "','recap','x','y','2026-01-01')", "update instruments set name = 'x'"];
    for (const sql of attempts) await asUser(pg, A, async () => { await expect(pg.query(sql)).rejects.toThrow(/permission denied/); });
  });
  it('server layer: each user\'s requests only ever touch their own data', async () => {
    const sa = await withUser(pool, A, (st) => new Service(st, NOW).load()); const sb = await withUser(pool, B, (st) => new Service(st, NOW).load());
    expect(sa.profile.displayName).toBe('Sam'); expect(sb.profile.displayName).toBe('Robin');
    const ids = new Set(sa.orders.map((o) => o.id)); expect(sb.orders.some((o) => ids.has(o.id))).toBe(false);
    const cashA = sa.account.cashCents; await withUser(pool, B, async (st) => { const s = new Service(st, NOW); await s.load(); await s.addMoney(5000); });
    expect((await withUser(pool, A, (st) => new Service(st, NOW).load())).account.cashCents).toBe(cashA);
  });
});

describe('account deletion', () => {
  it('removes every row the user owns', async () => {
    await deleteAccount(pool, B);
    for (const t of ['profiles', 'accounts', 'holdings', 'contributions', 'orders', 'goals', 'playlists', 'playlist_investments', 'chat_messages', 'chat_threads', 'notifications', 'notification_prefs', 'memberships']) {
      const col = t === 'playlists' ? 'owner_id' : 'user_id';
      expect((await pool.query(`select count(*)::int as n from ${t} where ${col} = $1`, [B])).rows[0].n, t).toBe(0);
    }
    expect((await pool.query('select count(*)::int as n from orders where user_id = $1', [A])).rows[0].n).toBeGreaterThan(0);
  });
});
