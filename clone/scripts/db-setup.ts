// npm run db:setup  -> applies supabase/migrations and loads the sample reference data into DATABASE_URL.
import { pgPool } from '../src/server/db';
import { ensureReference, migrate } from '../src/server/migrate';
(async () => {
  const pool = pgPool(); const applied = await migrate(pool);
  await pool.tx((db) => ensureReference(db));
  console.log(applied.length ? 'Applied: ' + applied.join(', ') : 'Database already up to date.', '\nReference data loaded.'); process.exit(0);
})().catch((e) => { console.error('db:setup failed:', e instanceof Error ? e.message : e); process.exit(1); });
