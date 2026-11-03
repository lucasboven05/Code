import { PGlite } from '@electric-sql/pglite';
import type { Db, Pool } from '@/server/db';
import { ensureReference, migrate } from '@/server/migrate';

function adapter(pg: { query: PGlite['query']; exec: PGlite['exec'] }): Db {
  return { async query(sql, params) {
    if (params === undefined) { const r = await pg.exec(sql); return { rows: (r[r.length - 1]?.rows ?? []) as any[] }; }   // multi-statement SQL (migrations)
    const r = await pg.query(sql, params as any[]); return { rows: r.rows as any[] }; } };
}
/** An in-process Postgres with a stand-in for Supabase's auth schema, then our real migrations and seed data. */
export async function makeDb() {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    alter default privileges in schema public grant all on tables to authenticated;`);
  const pool: Pool = { ...adapter(pg), tx: (fn) => pg.transaction((tx) => fn(adapter(tx as any))) };
  const applied = await migrate(pool); await ensureReference(pool);
  return { pg, pool, applied };
}
export async function addUser(pool: Pool, id = globalThis.crypto.randomUUID()) { await pool.query('insert into auth.users (id, email) values ($1, $2)', [id, id.slice(0, 8) + '@test.invalid']); return id; }
/** Run `fn` as the browser-facing role for one user, the way Supabase would. */
export async function asUser<T>(pg: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await pg.exec('reset role'); }
}
export const NOW = () => new Date('2026-06-15T15:00:00Z');
