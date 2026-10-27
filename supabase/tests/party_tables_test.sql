-- Party tables (SCOPE.md sections 8.1 and 9.6; D56): only a party's active members read it,
-- nobody writes from a client, and the rules about codes, HP, one party at a time, Realtime and
-- deleting accounts hold.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- A and B are in party P; D was in P and left; C is in party Q. Written as the database owner.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@party.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@party.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@party.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@party.local');
insert into public.profiles (id, hero_name, class, timezone) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ada', 'mage', 'America/Toronto');
insert into public.parties (id, name, code, creator_id, timezone) values
  ('40000000-0000-0000-0000-0000000000a0', 'Night Owls', 'K7M2QX', '00000000-0000-0000-0000-0000000000a1', 'America/Toronto'),
  ('40000000-0000-0000-0000-0000000000b0', 'Early Birds', 'ZZ22AB', '00000000-0000-0000-0000-0000000000c1', 'UTC');
insert into public.party_members (party_id, user_id, left_at) values
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a1', null),
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000b1', null),
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000d1', now()),
  ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c1', null);
insert into public.boss_weeks (id, party_id, week_start, boss_key, max_hp, current_hp) values
  ('50000000-0000-0000-0000-0000000000a0', '40000000-0000-0000-0000-0000000000a0', '2026-10-26', 'procrastination-slime', 1000, 980),
  ('50000000-0000-0000-0000-0000000000b0', '40000000-0000-0000-0000-0000000000b0', '2026-10-26', 'snooze-goblin', 500, 500);
insert into public.party_events (party_id, boss_week_id, user_id, kind, amount, habit_name) values
  ('40000000-0000-0000-0000-0000000000a0', '50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000b1', 'damage', 20, 'Read'),
  ('40000000-0000-0000-0000-0000000000b0', '50000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c1', 'damage', 15, 'Swim');
insert into public.boss_claims (boss_week_id, user_id) values
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a1'),
  ('50000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000b1');

-- The rules the schema enforces itself.
select throws_ok(
  $$insert into public.parties (name, code, timezone) values ('Bad code', 'ABCDEI', 'UTC')$$,
  '23514', null, 'a code with I or O is refused'
);
select throws_ok(
  $$insert into public.parties (name, code, timezone) values ('No', 'ABCDEF', 'UTC')$$,
  '23514', null, 'a name shorter than 3 is refused'
);
select throws_ok(
  $$insert into public.party_members (party_id, user_id)
    values ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'a player is in one party at a time'
);
select throws_ok(
  $$update public.boss_weeks set current_hp = -1 where id = '50000000-0000-0000-0000-0000000000a0'$$,
  '23514', null, 'boss HP never goes below 0'
);
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'party_events'),
  'the battle log is published to Realtime'
);

-- Signed in as A, an active member of P.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq('select id from public.parties', $$values ('40000000-0000-0000-0000-0000000000a0'::uuid)$$, 'A reads only their party');
select is((select count(*)::int from public.party_members), 3, 'A reads every member of P, past ones too, and none of Q');
select results_eq('select party_id from public.boss_weeks', $$values ('40000000-0000-0000-0000-0000000000a0'::uuid)$$, 'A reads only P''s boss');
select results_eq('select habit_name from public.party_events', $$values ('Read')$$, 'A reads only P''s battle log');
select results_eq('select user_id from public.boss_claims', $$values ('00000000-0000-0000-0000-0000000000a1'::uuid)$$, 'A reads only their own claims');
select is(public.is_party_member('40000000-0000-0000-0000-0000000000b0'), false, 'A is not a member of Q');
select throws_ok('select * from public.rate_limits', '42501', null, 'A can''t read the rate limits');

-- No writes from a client, not even to A's own party.
select throws_ok(
  $$insert into public.parties (name, code, timezone) values ('Mine', 'ABCDEF', 'UTC')$$,
  '42501', null, 'A can''t create a party directly'
);
select throws_ok(
  $$insert into public.party_members (party_id, user_id)
    values ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'A can''t join a party directly'
);
select throws_ok(
  $$update public.boss_weeks set current_hp = 0$$, '42501', null, 'A can''t change boss HP'
);
select throws_ok(
  $$insert into public.party_events (party_id, kind) values ('40000000-0000-0000-0000-0000000000a0', 'victory')$$,
  '42501', null, 'A can''t write the battle log'
);
select throws_ok(
  $$insert into public.boss_claims (boss_week_id, user_id)
    values ('50000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'A can''t claim a reward directly'
);

-- Signed in as D, who left P: nothing of P any more.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is_empty('select 1 from public.parties', 'after leaving, D reads no party');
select is_empty('select 1 from public.party_events', 'after leaving, D reads no battle log');

-- Not signed in.
reset role;
set local role anon;
select throws_ok('select * from public.parties', '42501', null, 'anonymous visitors read nothing');

-- Accounts, as the database owner.
reset role;
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from public.party_members where user_id = '00000000-0000-0000-0000-0000000000a1' and left_at is null),
  1,
  'replacing a hero (deleting the profile) keeps the account in its party'
);
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1';
select is_empty(
  $$select 1 from public.party_members where user_id = '00000000-0000-0000-0000-0000000000b1'
    union all select 1 from public.boss_claims where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  'deleting an account removes its membership and claims'
);
select is(
  (select count(*)::int from public.party_events where user_id = '00000000-0000-0000-0000-0000000000b1'),
  1,
  'a deleted member''s past damage stays in the log'
);
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select creator_id from public.parties where id = '40000000-0000-0000-0000-0000000000a0'),
  null,
  'the party carries on when its creator deletes their account'
);

select * from finish();
rollback;
