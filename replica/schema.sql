-- SOURCE OF TRUTH: clone/supabase/migrations/0001_init.sql (this file is a copy kept for the replica/ docs).
-- Alinea-style clone (private, simulated money). Postgres (Supabase). All times timestamptz (UTC).
-- Money = integer cents + currency. Per-share prices and quantities are numeric (a rate, not an amount);
-- order value is rounded to cents when a fill is booked.
-- gen_random_uuid() is built into Postgres 13+, so no extension is needed.

-- ---------- shared reference data (read by everyone, written only by service role / jobs) ----------
create table instruments (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text not null,
  type text not null check (type in ('stock','etf','crypto')),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prices (                      -- cached daily closes + latest quote; the only price source for fills
  instrument_id uuid not null references instruments(id) on delete cascade,
  as_of timestamptz not null,
  kind text not null check (kind in ('close','quote')),
  price numeric(18,6) not null check (price > 0),
  source text not null,
  primary key (instrument_id, kind, as_of)
);
create index on prices (instrument_id, kind, as_of desc);

create table model_portfolios (            -- SAMPLE portfolios, educational only (not advice)
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                -- stable key used by the app ('m1'..'m5')
  name text not null unique,
  risk_level smallint not null check (risk_level between 1 and 5),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table model_portfolio_allocations (
  model_portfolio_id uuid not null references model_portfolios(id) on delete cascade,
  instrument_id uuid not null references instruments(id) on delete restrict,
  weight_bps integer not null check (weight_bps > 0 and weight_bps <= 10000),
  primary key (model_portfolio_id, instrument_id)
);
create index on model_portfolio_allocations (instrument_id);

-- ---------- user data ----------
create table profiles (                    -- one row per auth user (Supabase auth.users)
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_year smallint check (birth_year between 1900 and 2100),
  risk_tolerance smallint check (risk_tolerance between 1 and 5),
  horizon_years smallint check (horizon_years between 1 and 80),
  goals jsonb not null default '[]',        -- questionnaire answers, e.g. ["first_home","retire_early"]
  questionnaire_step smallint not null default 0,
  onboarded_on date,                        -- practice start day (may be in the past: replayed plan)
  timezone text not null default 'America/Panama',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table accounts (                    -- the SIMULATED brokerage account (taxable only)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  model_portfolio_id uuid references model_portfolios(id) on delete set null,
  cash_cents bigint not null default 0 check (cash_cents >= 0),
  net_deposits_cents bigint not null default 0 check (net_deposits_cents >= 0),
  last_jobs_on date,                        -- last market day the job runner has processed
  currency text not null default 'USD',
  rebalance_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references instruments(id) on delete restrict,
  qty numeric(20,8) not null check (qty >= 0),
  cost_basis_cents bigint not null default 0 check (cost_basis_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, instrument_id)
);
create index on holdings (user_id);
create index on holdings (instrument_id);

create table contributions (                -- recurring schedules
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  frequency text not null check (frequency in ('once','weekly','biweekly','monthly')),
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  next_run_on date,                         -- in the user's timezone; job picks rows where next_run_on <= today
  status text not null default 'active' check (status in ('active','paused','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contributions (user_id);
create index on contributions (status, next_run_on);

create table orders (                       -- the activity log: every simulated fill, deposit and rebalance leg
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  instrument_id uuid references instruments(id) on delete restrict,
  contribution_id uuid references contributions(id) on delete set null,
  kind text not null check (kind in ('deposit','buy','sell','rebalance_buy','rebalance_sell','withdrawal')),
  qty numeric(20,8) check (qty > 0),
  price numeric(18,6) check (price > 0),
  amount_cents bigint not null check (amount_cents > 0),
  run_for date,                             -- the scheduled day this order belongs to (idempotency key with contribution_id)
  trade_date date not null,                 -- simulated market day of the fill (can be in the past when a plan is replayed)
  seq bigint generated always as identity,   -- insertion order (rows saved in one transaction share created_at)
  status text not null default 'filled' check (status in ('filled','failed','skipped')),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint trade_has_leg check (kind in ('deposit','withdrawal') or (instrument_id is not null and qty is not null and price is not null))
);
create index on orders (user_id, created_at desc);
create index on orders (account_id);
create index on orders (instrument_id);
-- a scheduled contribution can only execute once per day, even if the job runs twice
create unique index orders_contribution_once on orders (contribution_id, run_for, kind, coalesce(instrument_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where contribution_id is not null;   -- coalesce: deposits have no instrument, and NULLs would otherwise never collide

create table portfolio_snapshots (          -- end-of-day valuation for the performance chart
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  as_of date not null,
  value_cents bigint not null check (value_cents >= 0),
  net_deposits_cents bigint not null default 0,
  primary key (account_id, as_of)
);
create index on portfolio_snapshots (user_id, as_of desc);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_cents bigint not null check (target_amount_cents > 0),
  target_year smallint not null check (target_year between 2000 and 2200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on goals (user_id);

create table playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = built-in sample playlist
  name text not null,
  theme text not null default '',
  description text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on playlists (owner_id);
create table playlist_items (
  playlist_id uuid not null references playlists(id) on delete cascade,
  instrument_id uuid not null references instruments(id) on delete restrict,
  weight_bps integer not null check (weight_bps > 0 and weight_bps <= 10000),
  primary key (playlist_id, instrument_id)
);
create index on playlist_items (instrument_id);

-- weights of a playlist must total 100% (10000 bps) once it has items; checked at commit
create or replace function check_playlist_weights() returns trigger language plpgsql as $$
declare pid uuid := coalesce(new.playlist_id, old.playlist_id); total integer; n integer;
begin
  select coalesce(sum(weight_bps),0), count(*) into total, n from playlist_items where playlist_id = pid;
  if n > 0 and total <> 10000 then
    raise exception 'playlist % weights total % bps, must be 10000', pid, total;
  end if;
  return null;
end $$;
create constraint trigger playlist_weights_total after insert or update or delete on playlist_items
  deferrable initially deferred for each row execute function check_playlist_weights();

create table playlist_investments (         -- every 'invest in this playlist' action (append-only log)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_ref text not null,                -- built-in playlists are code (slug); own playlists are uuids
  amount_cents bigint not null check (amount_cents > 0),
  invested_on date not null,
  seq bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index on playlist_investments (user_id);

create table briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  summary text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, for_date)
);
create table briefing_items (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references briefings(id) on delete cascade,
  instrument_id uuid references instruments(id) on delete set null,
  headline text not null,
  source text not null,
  url text not null,
  published_at timestamptz
);
create index on briefing_items (briefing_id);
create index on briefing_items (instrument_id);

create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Allie',
  created_at timestamptz not null default now()
);
create index on chat_threads (user_id);
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  kind text not null default 'chat' check (kind in ('chat','recap')),
  sent_on date not null default current_date,
  seq bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index on chat_messages (thread_id, created_at);
create index on chat_messages (user_id);

create table memberships (                  -- informational only in the private clone (no payments)
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'private' check (plan in ('private','trial','annual')),
  status text not null default 'active' check (status in ('trial','active','cancelled')),
  renews_at timestamptz,
  updated_at timestamptz not null default now()
);

create table notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_briefing boolean not null default true,
  contribution_done boolean not null default true,
  rebalance_done boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- access rules ----------
-- 1. Row level security on everything. A signed-in browser can SELECT only its own rows (user_id = auth.uid()).
-- 2. Writes: revoked from the browser role on EVERY table. All writes go through server code that uses the
--    service connection, after the server has verified the user's token and validated the input.
-- 3. Reference tables (instruments, prices, model portfolios) are readable by any signed-in user.
do $$
declare t text;
begin
  foreach t in array array['instruments','prices','model_portfolios','model_portfolio_allocations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['profiles','accounts','holdings','contributions','orders','portfolio_snapshots','goals',
                           'playlist_investments','briefings','chat_threads','chat_messages','memberships','notification_prefs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for select to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

alter table playlists enable row level security;
create policy read_playlists on playlists for select to authenticated using (owner_id is null or is_public or owner_id = auth.uid());
alter table playlist_items enable row level security;
create policy read_items on playlist_items for select to authenticated using (
  exists (select 1 from playlists p where p.id = playlist_id and (p.owner_id is null or p.is_public or p.owner_id = auth.uid())));
alter table briefing_items enable row level security;
create policy own_items on briefing_items for select to authenticated using (
  exists (select 1 from briefings b where b.id = briefing_id and b.user_id = auth.uid()));

revoke insert, update, delete, truncate on all tables in schema public from authenticated;
