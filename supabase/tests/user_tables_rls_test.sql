-- Row Level Security on the player's tables (SCOPE.md sections 8.1 and 9.6): player A sees
-- only A's rows, can't write anything directly, and anonymous visitors see nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Two players with one row of everything, written as the database owner.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.profiles (id, hero_name, class, timezone) values
  ('00000000-0000-0000-0000-00000000000a', 'Ada', 'mage', 'America/Toronto'),
  ('00000000-0000-0000-0000-00000000000b', 'Bo', 'knight', 'Pacific/Auckland');
insert into public.characters (user_id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
insert into public.habits (id, user_id, name, type, difficulty, created_date, client_updated_at) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Read', 'daily', 'easy', '2026-10-20', now()),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Swim', 'daily', 'hard', '2026-10-20', now());
insert into public.completions (id, user_id, habit_id, local_date, completed_at, category, xp_awarded, gold_awarded, boss_damage) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '2026-10-21', now(), 'mind', 10, 3, 10),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '2026-10-21', now(), 'body', 30, 9, 30);
insert into public.day_closures (user_id, local_date, hp_lost, missed) values
  ('00000000-0000-0000-0000-00000000000a', '2026-10-20', 0, '[]'),
  ('00000000-0000-0000-0000-00000000000b', '2026-10-20', 6, '[]');
insert into public.inventory (id, user_id, item_id, purchased_at) values
  ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'oak-shield', now()),
  ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'wizard-hat', now());
insert into public.character_events (user_id, kind, ref_id, xp_delta) values
  ('00000000-0000-0000-0000-00000000000a', 'complete', '20000000-0000-0000-0000-00000000000a', 10),
  ('00000000-0000-0000-0000-00000000000b', 'complete', '20000000-0000-0000-0000-00000000000b', 30);

-- RLS is on everywhere, and the only policies are select policies.
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has RLS enabled'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and cmd <> 'SELECT'),
  0,
  'no policy lets a client write'
);

-- Signed in as player A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq('select id from public.profiles', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their profile');
select results_eq('select user_id from public.characters', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their hero');
select results_eq('select user_id from public.habits', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their habits');
select results_eq('select user_id from public.completions', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their completions');
select results_eq('select user_id from public.day_closures', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their day closures');
select results_eq('select user_id from public.inventory', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their inventory');
select results_eq('select user_id from public.character_events', $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$, 'A reads only their hero events');
select is_empty($$select 1 from public.habits where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'asking for B''s habits by id returns nothing');

-- A can't write, not even their own rows: every change must go through the sync function.
select throws_ok(
  $$insert into public.habits (id, user_id, name, type, difficulty, created_date, client_updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'Run', 'daily', 'easy', '2026-10-22', now())$$,
  '42501', null, 'A can''t insert a habit directly'
);
select throws_ok($$update public.habits set name = 'Nap' where id = '10000000-0000-0000-0000-00000000000a'$$, '42501', null, 'A can''t edit their habit directly');
select throws_ok($$update public.habits set name = 'Nap' where id = '10000000-0000-0000-0000-00000000000b'$$, '42501', null, 'A can''t edit B''s habit');
select throws_ok($$delete from public.completions$$, '42501', null, 'A can''t delete completions');
select throws_ok($$update public.characters set gold = 9999$$, '42501', null, 'A can''t give themselves gold');
select throws_ok($$insert into public.character_events (user_id, kind, ref_id) values ('00000000-0000-0000-0000-00000000000a', 'gift', 'x')$$, '42501', null, 'A can''t add hero events');
select throws_ok($$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000b'$$, '42501', null, 'A can''t delete B''s profile');
select throws_ok($$insert into public.inventory (id, user_id, item_id, purchased_at) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'dragon-cape', now())$$, '42501', null, 'A can''t buy gear directly');

-- Signed in as player B: the same tables now show only B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq('select name from public.habits', $$values ('Swim')$$, 'B reads only their habits');
select results_eq('select gold_awarded from public.completions', $$values (9)$$, 'B reads only their completions');

-- Not signed in: no access at all.
reset role;
set local role anon;
select throws_ok('select 1 from public.habits', '42501', null, 'anonymous visitors can''t read habits');
select throws_ok('select 1 from public.profiles', '42501', null, 'anonymous visitors can''t read profiles');

select * from finish();
rollback;
