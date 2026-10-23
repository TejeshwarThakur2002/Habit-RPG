-- The player's own tables (SCOPE.md section 8.1). Party tables follow in their own migration.
--
-- Clients only ever read these tables, and only their own rows. Every write goes through the
-- `sync` Edge Function, which uses the service role after checking the user's JWT, so RLS has
-- select policies only and insert, update and delete are revoked as well (DECISIONS.md D32).

-- Sync cursor ------------------------------------------------------------------------------

-- One global counter for every synced row: the client pulls rows with server_seq greater than
-- its cursor, which can't miss changes the way timestamps can with clock skew (section 8.3).
create sequence public.sync_seq;

create function public.stamp_sync_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_seq := nextval('public.sync_seq');
  new.updated_at := now();
  return new;
end;
$$;

-- Tables -----------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  hero_name text not null check (char_length(hero_name) between 2 and 20),
  class text not null check (class in ('knight', 'mage', 'rogue')),
  timezone text not null,
  created_at timestamptz not null default now(),
  server_seq bigint not null,
  updated_at timestamptz not null default now()
);

-- Server-owned: only the sync function and the nightly job change it.
create table public.characters (
  user_id uuid primary key references public.profiles on delete cascade,
  level int not null default 1 check (level >= 1),
  xp_in_level int not null default 0 check (xp_in_level >= 0),
  hp int not null default 44 check (hp >= 0),
  gold int not null default 0 check (gold >= 0),
  current_streak int not null default 0 check (current_streak >= 0),
  longest_streak int not null default 0 check (longest_streak >= 0),
  last_closed_date date,
  server_seq bigint not null,
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('daily', 'weekdays', 'bad')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  category text not null default 'none' check (category in ('body', 'mind', 'health', 'none')),
  -- Monday = 1 ... Sunday = 64.
  weekdays smallint not null default 127 check (weekdays between 0 and 127),
  reminder_time time,
  sort_order int not null default 0,
  -- Local date the habit was created; day close skips earlier days (D17, section 9.3).
  created_date date not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  client_updated_at timestamptz not null,
  server_seq bigint not null,
  updated_at timestamptz not null default now()
);

-- Insert-only ledger of what the player did; an undo sets undone_at, which never goes back.
create table public.completions (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  local_date date not null,
  completed_at timestamptz not null,
  category text not null check (category in ('body', 'mind', 'health', 'none')),
  xp_awarded int not null check (xp_awarded >= 0),
  gold_awarded int not null check (gold_awarded >= 0),
  boss_damage int not null check (boss_damage >= 0),
  is_late boolean not null default false,
  undone_at timestamptz,
  server_seq bigint not null,
  updated_at timestamptz not null default now()
);
create unique index one_completion_per_habit_day
  on public.completions (habit_id, local_date)
  where undone_at is null;

-- The primary key makes closing the same day twice a no-op, so the nightly job is idempotent.
create table public.day_closures (
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  closed_at timestamptz not null default now(),
  hp_lost int not null check (hp_lost >= 0),
  missed jsonb not null,
  server_seq bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table public.inventory (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  item_id text not null,
  equipped boolean not null default false,
  purchased_at timestamptz not null,
  server_seq bigint not null,
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- Audit ledger of every change to the hero. The unique key makes each effect apply once, so a
-- retried sync can't award XP twice. Not synced to the phone.
create table public.character_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (char_length(kind) > 0),
  ref_id text not null check (char_length(ref_id) > 0),
  xp_delta int,
  gold_delta int,
  hp_delta int,
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
create index character_events_user on public.character_events (user_id, id);

-- Sync stamps and pull indexes -----------------------------------------------------------

do $$
declare
  synced text[] := array['profiles', 'characters', 'habits', 'completions', 'day_closures', 'inventory'];
  t text;
begin
  foreach t in array synced loop
    execute format(
      'create trigger stamp_sync_fields before insert or update on public.%I '
      'for each row execute function public.stamp_sync_fields()',
      t
    );
  end loop;
end;
$$;

create index profiles_sync on public.profiles (id, server_seq);
create index characters_sync on public.characters (user_id, server_seq);
create index habits_sync on public.habits (user_id, server_seq);
create index completions_sync on public.completions (user_id, server_seq);
create index day_closures_sync on public.day_closures (user_id, server_seq);
create index inventory_sync on public.inventory (user_id, server_seq);

-- Row Level Security -----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.habits enable row level security;
alter table public.completions enable row level security;
alter table public.day_closures enable row level security;
alter table public.inventory enable row level security;
alter table public.character_events enable row level security;

-- `(select auth.uid())` is evaluated once per query rather than per row (Supabase RLS guide).
create policy "Players read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Players read their own hero" on public.characters
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Players read their own habits" on public.habits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Players read their own completions" on public.completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Players read their own day closures" on public.day_closures
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Players read their own inventory" on public.inventory
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Players read their own hero events" on public.character_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Defence in depth: even with a policy mistake, clients can't write. Supabase grants these
-- privileges by default; the service role used by Edge Functions keeps them.
revoke all on
  public.profiles, public.characters, public.habits, public.completions,
  public.day_closures, public.inventory, public.character_events
from anon;
revoke insert, update, delete, truncate, references, trigger on
  public.profiles, public.characters, public.habits, public.completions,
  public.day_closures, public.inventory, public.character_events
from authenticated;
revoke all on sequence public.sync_seq from anon, authenticated;
revoke execute on function public.stamp_sync_fields() from public, anon, authenticated;
