create extension if not exists pgcrypto;

create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  label text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  device_hash text not null,
  trust_score int not null,
  is_verified boolean not null default false
);

create unique index if not exists votes_unique_device
  on votes(poll_id, device_hash);

create table if not exists poll_counts (
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  vote_count bigint not null default 0,
  primary key (poll_id, option_id)
);

create table if not exists ip_reputation (
  ip_hash text primary key,
  score int not null default 0,
  last_vote_at timestamptz,
  window_count int not null default 0
);

create table if not exists trust_events (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls(id) on delete cascade,
  session_id text,
  reason text not null,
  delta int not null,
  created_at timestamptz not null default now()
);

alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_counts enable row level security;

create policy "read polls" on polls
  for select using (true);

create policy "read poll options" on poll_options
  for select using (true);

create policy "read poll counts" on poll_counts
  for select using (true);
