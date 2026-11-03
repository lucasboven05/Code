import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { INSTRUMENTS, MODELS } from '@/lib/seed';
import type { Db, Pool } from './db';

/** Apply supabase/migrations/*.sql in name order, once each. Safe to run repeatedly. */
export async function migrate(pool: Pool, dir = path.resolve(process.cwd(), 'supabase/migrations')): Promise<string[]> {
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await pool.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await pool.tx(async (db) => { await db.query(readFileSync(path.join(dir, f), 'utf8')); await db.query('insert into schema_migrations (name) values ($1)', [f]); });
    applied.push(f);
  }
  return applied;
}

/** Fictional sample instruments and portfolios live in code (src/lib/seed.ts); mirror them into the reference tables. */
export async function ensureReference(db: Db): Promise<void> {
  for (const i of INSTRUMENTS) await db.query(
    `insert into instruments (ticker, name, type) values ($1,$2,$3) on conflict (ticker) do update set name = excluded.name, type = excluded.type, updated_at = now()`, [i.ticker, i.name, i.type]);
  for (const m of MODELS) {
    const r = await db.query<{ id: string }>(
      `insert into model_portfolios (slug, name, risk_level, description) values ($1,$2,$3,$4)
       on conflict (slug) do update set name = excluded.name, risk_level = excluded.risk_level, description = excluded.description, updated_at = now() returning id`,
      [m.id, m.name, m.riskLevel, m.description]);
    const id = r.rows[0].id;
    await db.query('delete from model_portfolio_allocations where model_portfolio_id = $1', [id]);
    for (const a of m.allocations) await db.query(
      'insert into model_portfolio_allocations (model_portfolio_id, instrument_id, weight_bps) select $1, id, $3 from instruments where ticker = $2', [id, a.ticker, a.weightBps]);
  }
}
