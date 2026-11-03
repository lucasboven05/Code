// Minimal database interface so the same code runs on node-postgres (production) and PGlite (tests).
import { Pool as PgPool } from 'pg';

export interface Db { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }
export interface Pool extends Db { tx<T>(fn: (db: Db) => Promise<T>): Promise<T> }

let shared: Pool | null = null;
export function pgPool(url = process.env.DATABASE_URL): Pool {
  if (shared) return shared;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new PgPool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  shared = {
    query: (sql, params) => pool.query(sql, params as any[]) as any,
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const r = await fn({ query: (sql, params) => c.query(sql, params as any[]) as any });
        await c.query('commit'); return r;
      } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
    },
  };
  return shared;
}
