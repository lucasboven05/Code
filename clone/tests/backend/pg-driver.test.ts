// Runs only when TEST_DATABASE_URL points at a real Postgres that already has the auth stub + migrations (see backend.md).
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgPool, type Pool } from '@/server/db';
import { getState, handleRpc } from '@/server/rpc';
import { NOW } from './helpers';

const URL = process.env.TEST_DATABASE_URL;
describe.skipIf(!URL)('real Postgres via the pg driver', () => {
  let pool: Pool; const A = globalThis.crypto.randomUUID(), B = globalThis.crypto.randomUUID();
  beforeAll(async () => { pool = pgPool(URL); for (const u of [A, B]) await pool.query('insert into auth.users (id, email) values ($1, $2)', [u, u.slice(0, 8) + '@test.invalid']); }, 60_000);
  afterAll(async () => { await pool.query('delete from auth.users where id = any($1::uuid[])', [[A, B]]); });
  const rpc = (userId: string, method: string, ...args: unknown[]) => handleRpc({ pool, userId, method, args, now: NOW });

  it('commits a transaction and rolls one back', async () => {
    const id = globalThis.crypto.randomUUID();
    await expect(pool.tx(async (db) => { await db.query('insert into auth.users (id) values ($1)', [id]); throw new Error('abort'); })).rejects.toThrow('abort');
    expect((await pool.query('select count(*)::int as n from auth.users where id = $1', [id])).rows[0].n).toBe(0);
    await pool.tx((db) => db.query('insert into auth.users (id) values ($1)', [id])); expect((await pool.query('select count(*)::int as n from auth.users where id = $1', [id])).rows[0].n).toBe(1);
    await pool.query('delete from auth.users where id = $1', [id]);
  });
  it('concurrent requests from one user are serialized: none is lost', async () => {
    await rpc(A, 'saveProfile', { riskTolerance: 3, horizonYears: 8, step: 5 });
    await rpc(A, 'completeOnboarding', { amountCents: 5000, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 3, start: 'today' });
    const before = await getState({ pool, userId: A, now: NOW });
    await Promise.all(Array.from({ length: 8 }, () => rpc(A, 'addMoney', 1000)));
    const after = await getState({ pool, userId: A, now: NOW });
    expect(after.account.cashCents).toBe(before.account.cashCents + 8000); expect(after.account.netDepositsCents).toBe(before.account.netDepositsCents + 8000);
    expect(after.orders.length).toBe(before.orders.length + 8);
  });
  it('concurrent requests from different users run in parallel without crossing', async () => {
    await rpc(B, 'saveProfile', { riskTolerance: 2, horizonYears: 4, step: 5 }); await rpc(B, 'completeOnboarding', { amountCents: 5000, frequency: 'monthly', dayOfWeek: null, dayOfMonth: 3, start: 'today' });
    const a0 = (await getState({ pool, userId: A, now: NOW })).account.cashCents, b0 = (await getState({ pool, userId: B, now: NOW })).account.cashCents;
    await Promise.all([...Array.from({ length: 4 }, () => rpc(A, 'addMoney', 2000)), ...Array.from({ length: 4 }, () => rpc(B, 'addMoney', 3000))]);
    expect((await getState({ pool, userId: A, now: NOW })).account.cashCents).toBe(a0 + 8000); expect((await getState({ pool, userId: B, now: NOW })).account.cashCents).toBe(b0 + 12000);
  });
  it('row level security holds for the browser role on real Postgres', async () => {
    const c = new Client({ connectionString: URL }); await c.connect();
    try {
      await c.query(`set role authenticated; select set_config('request.jwt.claim.sub', '${A}', false)`);
      expect((await c.query('select distinct user_id from accounts')).rows).toEqual([{ user_id: A }]);
      expect((await c.query('select count(*)::int as n from orders where user_id = $1', [B])).rows[0].n).toBe(0);
      await expect(c.query('update accounts set cash_cents = 99999999')).rejects.toThrow(/permission denied/);
      await expect(c.query('delete from orders')).rejects.toThrow(/permission denied/);
    } finally { await c.end(); }
  });
});
