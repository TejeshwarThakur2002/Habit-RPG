-- Parties and weekly bosses (SCOPE.md sections 3, 8.1 and 9.2; DECISIONS.md D56).
--
-- Like the player tables (D32), clients only read: every write goes through the `party`, `sync`
-- and `daily-tick` Edge Functions with the service role. A party's rows are readable only by
-- its active members, through is_party_member().
--
-- Membership belongs to the account, not to a hero: party_members and boss_claims reference
-- auth.users, so replacing an account's hero (D49), which deletes its profile, keeps the account
-- in its party (D56). Deleting the account removes both. party_events.user_id has no foreign
-- key on purpose: a deleted member's past damage stays in the log as a former member (D56).

-- Tables -----------------------------------------------------------------------------------

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 24),
  -- Six characters from A to Z without I and O, and 2 to 9 (section 3).
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- The creator's account; the party carries on if it is deleted.
  creator_id uuid references auth.users on delete set null,
  -- The party week runs Monday to Sunday here, fixed at creation (section 3).
  timezone text not null,
  created_at timestamptz not null default now()
);

create table public.party_members (
  party_id uuid not null references public.parties on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (party_id, user_id)
);
-- One party at a time (section 3).
create unique index one_active_party_per_user on public.party_members (user_id)
  where left_at is null;

create table public.boss_weeks (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties on delete cascade,
  week_start date not null,
  boss_key text not null check (boss_key in (
    'procrastination-slime', 'snooze-goblin', 'doomscroll-wraith', 'couch-golem',
    'deadline-dragon', 'junk-food-ogre', 'burnout-specter', 'monday'
  )),
  max_hp int not null check (max_hp > 0),
  current_hp int not null,
  defeated_at timestamptz,
  unique (party_id, week_start),
  check (current_hp between 0 and max_hp)
);

-- The battle log, published to Realtime. `undo` gives back the damage of an undone completion.
create table public.party_events (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties on delete cascade,
  boss_week_id uuid references public.boss_weeks on delete cascade,
  user_id uuid,
  kind text not null check (kind in ('damage', 'undo', 'boss_attack', 'victory', 'join', 'leave')),
  amount int check (amount >= 0),
  habit_name text,
  created_at timestamptz not null default now()
);
create index party_events_recent on public.party_events (party_id, created_at desc);

-- A reward is claimed once per boss and member (section 9.2).
create table public.boss_claims (
  boss_week_id uuid not null references public.boss_weeks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (boss_week_id, user_id)
);

-- The `party` function's rate limit: calls in the current minute, per account (section 9.2).
create table public.rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  calls int not null check (calls >= 0)
);

-- Membership check -------------------------------------------------------------------------

-- security definer so the policies below can look at party_members without recursing into its
-- own policy. It answers only for the signed-in user.
create function public.is_party_member(party uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.party_members m
    where m.party_id = party and m.user_id = (select auth.uid()) and m.left_at is null
  );
$$;
revoke execute on function public.is_party_member(uuid) from public, anon;
grant execute on function public.is_party_member(uuid) to authenticated;

-- Row Level Security -----------------------------------------------------------------------

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.boss_weeks enable row level security;
alter table public.party_events enable row level security;
alter table public.boss_claims enable row level security;
-- No policy at all: only the functions read or write it.
alter table public.rate_limits enable row level security;

create policy "Members read their party" on public.parties
  for select to authenticated using (public.is_party_member(id));
create policy "Members read their party's members" on public.party_members
  for select to authenticated using (public.is_party_member(party_id));
create policy "Members read their party's bosses" on public.boss_weeks
  for select to authenticated using (public.is_party_member(party_id));
create policy "Members read their party's battle log" on public.party_events
  for select to authenticated using (public.is_party_member(party_id));
create policy "Players read their own claims" on public.boss_claims
  for select to authenticated using (user_id = (select auth.uid()));

-- As for the player tables (D32): clients can't write, even with a policy mistake.
revoke all on
  public.parties, public.party_members, public.boss_weeks, public.party_events,
  public.boss_claims, public.rate_limits
from anon;
revoke insert, update, delete, truncate, references, trigger on
  public.parties, public.party_members, public.boss_weeks, public.party_events,
  public.boss_claims, public.rate_limits
from authenticated;
revoke select on public.rate_limits from authenticated;

-- Realtime ---------------------------------------------------------------------------------

-- New battle-log rows reach members' Party screens within seconds (F7). Realtime applies the
-- select policy above, so only the party's active members receive them.
alter publication supabase_realtime add table public.party_events;
