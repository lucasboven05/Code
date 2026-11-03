import type { AllieFn } from '@/lib/data';
import { Service } from '@/lib/data';
import type { Pool } from './db';
import { withUser } from './pgstore';

/** Daily job: for every onboarded user, replay any market days since their last run (scheduled contributions, rebalancing).
 *  Idempotent: a second run the same day changes nothing. One user failing never stops the others. */
export async function runDaily(pool: Pool, now: () => Date = () => new Date(), allie?: AllieFn) {
  const ids = (await pool.query<{ user_id: string }>('select user_id from accounts where model_portfolio_id is not null order by user_id limit 1000')).rows.map((r) => r.user_id);
  let ok = 0, failed = 0;
  for (const id of ids) {
    try { await withUser(pool, id, async (store) => { await new Service(store, now, allie).load(); }); ok++; }
    catch (e) { failed++; console.error('daily job failed for a user:', e instanceof Error ? e.message : String(e)); }
  }
  return { users: ids.length, ok, failed };
}
