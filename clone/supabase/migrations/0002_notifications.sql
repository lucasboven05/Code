-- In-app inbox: contribution made, rebalanced, daily briefing, weekly recap. Written only by server code.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('contribution','rebalance','briefing','recap')),
  title text not null,
  body text not null,
  notice_date date not null,
  read boolean not null default false,
  seq bigint generated always as identity,        -- display and load order
  created_at timestamptz not null default now()
);
create index on notifications (user_id, seq);

alter table notifications enable row level security;
create policy own_rows on notifications for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on notifications from authenticated;   -- the browser can read its own, never write
