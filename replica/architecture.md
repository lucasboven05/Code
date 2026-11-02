# Architecture: Alinea-style clone (private, simulated money)

Built from `recon.md` + `features.csv`. One user (you), phone-first PWA, paper money only. Official public APIs with your own keys only; nothing from Alinea's code or private endpoints.

## 1. Stack
| layer | choice | why |
|---|---|---|
| web app | Next.js (App Router) + TypeScript, installable PWA | one codebase for phone browser and home-screen app; server actions keep money logic on the server |
| styling | Tailwind, tokens from `/replica-design` | tokens come from the design step |
| mobile | none for now (PWA); Expo later if wanted | recon decision: phone web app first |
| database | Postgres on Supabase | managed, one database, row level security built in |
| ORM | Drizzle | typed SQL, migrations from `schema.sql` |
| auth | Supabase Auth (email magic link) | private app, one user; no passwords to store |
| payments | none | membership is informational only (private use) |
| email | none for v1 | notifications are in-app; add Resend later if wanted |
| jobs | Vercel Cron calling signed route handlers | scheduled contributions, rebalance, prices, briefing, snapshots |
| files | none | nothing to store |
| market data | one official price/news API, your own key (Finnhub, Twelve Data or Alpha Vantage; pick at build time and check its current free-tier limits) | stock profiles, charts, news; cached in `prices` so the app never calls it per page view |
| LLM (Allie) | Anthropic API, your own key, server side | educational chat grounded in your holdings |
| hosting | Vercel | zero-ops |

Access control: **Postgres row level security** on every user-owned table (written in `schema.sql`). Money-moving tables (accounts, holdings, orders, snapshots) are writable only by server code using the service role, inside one transaction.

## 2. Schema
`replica/schema.sql` (20 tables, parses with pglast; not yet run on a live database).
- Reference (service-role write, all read): `instruments`, `prices`, `model_portfolios`, `model_portfolio_allocations`
- Your data: `profiles`, `accounts`, `holdings`, `contributions`, `orders`, `portfolio_snapshots`, `goals`, `playlists`, `playlist_items`, `playlist_investments`, `briefings`, `briefing_items`, `chat_threads`, `chat_messages`, `memberships`, `notification_prefs`
- Money = integer cents + currency. Per-share prices and quantities are `numeric` (a rate, not an amount); a fill's value is rounded to cents when booked. This is a deliberate exception to the "all money in cents" rule.
- Hard constraints: `cash_cents >= 0`; one `accounts` row per user; `unique(account_id, instrument_id)` on holdings; weights are basis points and a **deferred trigger** forces a playlist's weights to total 10000 at commit; a **partial unique index** (`orders_contribution_once`) stops a scheduled contribution executing twice for the same day.

## 3. API
Server actions or route handlers. "Me" = signed-in owner. Jobs = signed cron calls only.
| method path | what it does | who | input > output | flow |
|---|---|---|---|---|
| POST /api/onboarding/answer | save one questionnaire step | me | step, answer > next step | F01 |
| POST /api/onboarding/complete | match a model portfolio, create simulated account | me | none > portfolio + account | F01 |
| GET /api/portfolio/match | preview matched portfolio | me | none > allocations + risk label | F01 |
| POST /api/contributions | create schedule or one-off deposit and invest | me | amount, frequency, day > contribution | F01, F07 |
| PATCH /api/contributions/:id | pause, resume, change amount | me | patch > contribution | F07 |
| GET /api/home | balance, performance series, holdings, today's briefing | me | range > JSON | F06 |
| GET /api/holdings/:ticker | stock profile (price series, stats, news, Allie summary) | me | ticker > JSON | F06 |
| GET /api/activity | orders, paged | me | cursor > list | F06 |
| GET /api/playlists | built-in + mine + public | me | q, theme > list | F02 |
| GET /api/playlists/:id | detail + performance | me | id > JSON | F02 |
| POST /api/playlists | create (weights must total 100%) | me | name, items > playlist | F03 |
| PATCH /api/playlists/:id | edit, share toggle | me | patch > playlist | F03 |
| POST /api/playlists/:id/invest | invest an amount across its weights | me | amount > orders | F02 |
| GET/POST/PATCH/DELETE /api/goals | yearly goals | me | goal > goal | F05 |
| GET /api/projections | hypothetical growth for goals, with assumptions shown | me | goal id, assumed return > series | F05 |
| POST /api/allie/chat | send a message, stream the reply | me | thread, text > stream | F04 |
| GET /api/allie/recap | latest AI recap card | me | none > card | F04 |
| GET/PATCH /api/settings | profile, notifications, timezone | me | patch > settings | F07 |
| POST /api/account/reset | wipe the simulation and restart with fresh cash | me | confirm > ok | F07 |
| DELETE /api/account | delete everything for me (cascade) | me | confirm > ok | GDPR |
Webhooks: none (no payments). Outbound: none.

**Jobs (Vercel Cron, each idempotent):**
| job | schedule (UTC) | what |
|---|---|---|
| prices-refresh | every 15 min, US market hours | pull quotes for held and watched instruments into `prices` |
| prices-close | daily after US close | store official closes |
| contributions-run | daily, early US morning | for each active schedule due today (user timezone) deposit and buy per target weights |
| rebalance | weekly | move holdings back toward the model weights if drift > threshold; skip on closed-market days |
| snapshots | daily after close | write `portfolio_snapshots` |
| briefing-build | daily, before US open | news per holding > `briefings` + summary |

## 4. The parts that bite
- **Time zones and market calendar.** Panama is UTC-5 all year; New York shifts with daylight saving. Schedules are stored as a date in the user's timezone; the job decides "is it due" and "is the market open (weekends, US holidays, early closes)" before filling. Closed day = fill at next open, or skip with a note.
- **Idempotency.** Cron can fire twice. The partial unique index on `orders` makes the second run a no-op; every job takes a lock and logs its run.
- **Race conditions on cash.** Any buy runs in one transaction with `select ... for update` on the account row so cash can never go negative (also enforced by the check constraint).
- **Fractional math.** Quantities at 8 decimals, rounding down on buys, rounded cents on value; weights in basis points; remainders stay as cash.
- **Fills are simulated.** A fill uses the latest cached price, labelled delayed. No slippage model in v1. Say this in the UI.
- **Market-data limits and cost.** Free tiers have rate limits; cache everything in `prices`, never call the provider from page views, batch by ticker list, and back off on 429.
- **Allie is an LLM.** Educational only: system prompt forbids personalised buy/sell advice, always shows the disclaimer, answers from a context block (your holdings, goals, recent news) passed by the server, no tools that can place orders. Cap tokens per message and per day to bound cost.
- **Projections are hypothetical.** Show assumptions (rate, years, contributions) and a "not a guarantee" label; never show a single number without the range.
- **Sample portfolios are not advice.** Label model portfolios "sample, educational"; they exist so the product flow works.
- **Privacy.** Single user, RLS on, service key only on the server, API keys in env vars never in the browser, `DELETE /api/account` cascades everything.
- **Offline.** PWA shell and last-loaded home screen cache only; no offline writes.
- **Search.** Instrument search is a Postgres `ilike` on ticker/name for v1; add trigram index only if slow.

## 5. Build order
**M1 Vertical slice (ugly, end to end).** Sign in > 5-question questionnaire (S02) > matched portfolio (S03) > fund + monthly schedule (S04) > simulated buy > home with balance and holdings (S05).
Tables: profiles, instruments, prices, model_portfolios (+allocations), accounts, holdings, contributions, orders. Routes: onboarding/*, portfolio/match, contributions, home. Jobs: prices-refresh, contributions-run.

**M2 Must-haves.** Stock profile (S06), Playlists browse + detail + invest (S07, S08), Goals and projections (S10), Allie chat (S11), Legal pages (S18), performance chart (snapshots job).
Tables: playlists, playlist_items, playlist_investments, goals, chat_threads, chat_messages, portfolio_snapshots. Routes: holdings/:ticker, playlists, goals, projections, allie/chat. Jobs: prices-close, snapshots.

**M3 Should-haves.** Rebalancing, Daily Briefing (S12), playlist builder (S09), Activity (S13), Allie recaps, settings (S16).
Tables: briefings, briefing_items, notification_prefs. Jobs: rebalance, briefing-build.

**M4 Could-haves.** Crypto with simulated prices (S14), community feed limited to own playlists (S15), membership screen (S17), notifications, marketing landing page + savings calculator (S19).

**M5 Fixes** after `/replica-entrepreneur`, then `/replica-test`, `/replica-diff`.

## Summary numbers
20 tables, 20 API route entries, 6 jobs, 5 milestones. Skipped by design: real brokerage, custody, advice, bank linking, KYC, payments.
