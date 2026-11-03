# Backend (replica-backend, 2026-11-03)

Code: `clone/src/server/*` (logic), `clone/src/app/api/*` (thin routes), `clone/supabase/migrations/0001_init.sql` (schema + access rules), `clone/src/lib/remote.ts` (browser side).
Offline mode still works: leave `NEXT_PUBLIC_BACKEND` unset and nothing below is needed.

## How it fits together
- **One rule engine, two stores.** `Service` (src/lib/data.ts) holds all the rules. In the browser-only mode its store is localStorage; on the server its store is Postgres (`PgStore`). The browser's `RemoteData` sends each change to `/api/rpc` and reads back the new state; reads (home, charts, projections) are computed locally from that state.
- **Auth:** Supabase email magic link. The browser holds the session and sends `Authorization: Bearer <access token>`. The server verifies the token and uses its `sub` as the only identity; no endpoint accepts a user id from the request.
- **Writes only through the server.** Every table has row level security allowing the signed-in role to SELECT its own rows, and INSERT/UPDATE/DELETE are revoked from that role on every table. The browser cannot change money tables even with the public anon key.
- **One user at a time.** Each request runs in one transaction under a per-user advisory lock.
- **Jobs:** `/api/cron/daily` (Vercel Cron, `vercel.json`, weekdays 21:30 UTC, `Authorization: Bearer $CRON_SECRET`) replays missed market days for every user. Idempotent.
- **Allie:** with `ANTHROPIC_API_KEY` set, Allie calls the Claude API from the server (model `claude-opus-5-5` by default, `ALLIE_MODEL` to change, low effort, server-side refusal fallback). With no key, or on any error or refusal, it falls back to the scripted answers.

## Inbox (migration 0002)
`notifications` table (read by its owner under row level security, written only by the server). The job runner and every load turn what happened into notices (contribution made, rebalanced, daily briefing, weekly recap), respecting the three switches, announcing only the last 7 days, never twice. New action `markAllNoticesRead`.

## Routes
| route | what | auth |
|---|---|---|
| GET /api/state | load the signed-in user's state (runs due jobs) | bearer token |
| POST /api/rpc | one of 18 whitelisted actions, each with its own zod schema | bearer token, rate limited (120/min, chat 15/min) |
| DELETE /api/account | delete the sign-in user; everything cascades | bearer token + `{"confirm":true}` |
| GET /api/cron/daily | run the daily job for all users | `CRON_SECRET` bearer, constant-time compare |

## What you need to do (I cannot create accounts or handle keys)
1. Create a Supabase project. In **Authentication > Providers** keep Email (magic link) on; in **URL configuration** set the Site URL and a redirect URL to your deployed address.
2. Set up **custom SMTP** in Supabase for real use: its built-in email sender is limited and meant for testing.
3. Copy `clone/.env.example` to `.env.local`; fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (Supabase: Settings > Database), and a long random `CRON_SECRET`. Set `SUPABASE_JWT_SECRET` only if your project still uses the legacy shared secret.
4. `cd clone && npm run db:setup` (applies the migration and loads the sample reference data; safe to re-run).
5. Optional: `ANTHROPIC_API_KEY` for Allie's AI mode. Check the dashboard that daily backups are enabled for your Supabase plan.
6. Deploy (e.g. Vercel), set the same variables there, and open the app.

## Security checklist
- [x] Secrets only in env vars; `.env*` ignored (`.env.example` tracked, no values); built bundle grepped for the secret values with them set: none found.
- [x] Server-side input validation on every route: envelope (size, JSON, no unknown keys) plus a zod schema per action; unknown actions, prototype names and extra keys rejected (tested).
- [x] Authorisation on every read and write, tested with a second user at three layers: database (browser role sees only its own rows; writes denied), server (each user's requests only touch their own data; another user's ids are no-ops or errors), HTTP (a second user's token returns an empty account). Mutation-checked: with row level security off the test fails.
- [~] Rate limits: app routes are limited in memory per server instance (enough to stop a runaway client, not a distributed attack). Sign-in emails are sent and limited by Supabase Auth, not by this app.
- [x] Webhooks: none exist. The cron route verifies a secret.
- [x] Uploads: none.
- [x] No user data in URLs; server logs only error messages, never state, tokens or request bodies (by inspection).
- [~] `npm audit`: critical findings in the test runner fixed by upgrading vitest to 5. Two remain (PostCSS inside Next's build step, which only processes this project's own CSS); the fix is a major Next upgrade, not done.
- [x] Privacy text lists the processors that apply (Supabase, Vercel, Anthropic when AI mode is on) on the Legal screen. It is plain information, not legal advice.

## Verified here
- 114 tests (as of the notifications work): engine, regressions, stock figures and inbox logic, migrations + constraints + row level security + round trip + deletion on PGlite, server rules, auth, Allie adapter, daily job, HTTP handlers + browser data layer against them, and 4 on **real PostgreSQL 16** through the real `pg` driver (`TEST_DATABASE_URL=postgres://... npm test`): commit/rollback, 8 simultaneous requests for one user all applied (without the lock 6 of 8 were lost), two users in parallel, row level security.
- `e2e/backend.cjs`: real browser against the real Next server and real Postgres: signed-out sign-in screen and validation, API refuses no token, whole onboarding stored in Postgres (12 deposits, 76 orders), nothing app-related left in browser storage, cash/playlist/Allie actions, reload re-reads the server, a second user sees nothing, account deletion removes every row.
- Offline mode regression: both original browser suites still pass; first-load JS back to about 120 kB (Supabase client loads only when a backend is configured).

## Not verified (needs your Supabase project or keys)
- **Supabase Auth itself**: sending the magic link, completing sign-in, token refresh. The browser was given a correctly signed session instead. Tokens signed with the legacy secret (HS256) are tested; verification against a project's published signing keys (the newer default) is written but **untested**.
- Supabase specifics: its real `auth.uid()`, the pooled connection string, and that `delete from auth.users` works with your `DATABASE_URL` role. The tests use a stand-in auth schema.
- **Allie against the real Claude API**: tested with a mocked client only (request shape, fallbacks, refusal and error handling). No real call was made.
- Backups, custom SMTP, and Vercel Cron on your plan.

## Known gaps and decisions for you
- **Prices are still simulated.** A real market-data provider needs your choice and key (e.g. Finnhub, Twelve Data, Alpha Vantage; check each one's current free-tier limits) and a change from synchronous simulated prices to a cached `prices` table. Not started.
- **Session storage:** supabase-js keeps the session in browser storage, not an http-only cookie. Fine for a private single-user app; move to `@supabase/ssr` cookies before offering it to others.
- Browser-only data is not imported into an account; it stays in that browser.
- No payments or transactional email beyond Supabase's sign-in email: neither was in scope for a private app.
