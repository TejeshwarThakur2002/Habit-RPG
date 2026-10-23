-- The player's tables (SCOPE.md section 8.1): sync stamps, the rules the schema enforces, and
-- account deletion removing everything.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select tables_are(
  'public',
  array['profiles', 'characters', 'habits', 'completions', 'day_closures', 'inventory', 'character_events'],
  'the player tables exist'
);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

-- Edge Functions write as the service role; the sync stamp trigger must work for it.
set local role service_role;
insert into public.profiles (id, hero_name, class, timezone)
  values ('00000000-0000-0000-0000-00000000000a', 'Ada', 'mage', 'America/Toronto');
insert into public.characters (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.habits (id, user_id, name, type, difficulty, created_date, client_updated_at)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Read', 'daily', 'easy', '2026-10-20', now());

select isnt((select server_seq from public.habits), null, 'inserting stamps server_seq');
select ok(
  (select server_seq from public.habits) > (select server_seq from public.profiles),
  'later writes get a higher server_seq'
);

-- Updates take a fresh number, so a client pulling "after my cursor" sees the change.
create temporary table seq_before as select server_seq from public.habits;
update public.habits set name = 'Read 20 pages';
select ok(
  (select server_seq from public.habits) > (select server_seq from seq_before),
  'updating stamps a higher server_seq'
);
select is((select level from public.characters), 1, 'a new hero starts at level 1');
select is((select hp from public.characters), 44, 'a new hero starts with 44 HP');

-- One active completion per habit per day; an undone one frees the day again.
insert into public.completions (id, user_id, habit_id, local_date, completed_at, category, xp_awarded, gold_awarded, boss_damage)
  values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '2026-10-21', now(), 'mind', 10, 3, 10);
select throws_ok(
  $$insert into public.completions (id, user_id, habit_id, local_date, completed_at, category, xp_awarded, gold_awarded, boss_damage)
    values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '2026-10-21', now(), 'mind', 10, 3, 10)$$,
  '23505', null, 'a second completion for the same day is refused'
);
update public.completions set undone_at = now() where id = '20000000-0000-0000-0000-000000000001';
select lives_ok(
  $$insert into public.completions (id, user_id, habit_id, local_date, completed_at, category, xp_awarded, gold_awarded, boss_damage)
    values ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '2026-10-21', now(), 'mind', 10, 3, 10)$$,
  'after an undo the day can be completed again'
);

-- Each effect on the hero is recorded once, so a retried sync can't apply it twice.
insert into public.character_events (user_id, kind, ref_id, xp_delta)
  values ('00000000-0000-0000-0000-00000000000a', 'complete', '20000000-0000-0000-0000-000000000003', 10);
select throws_ok(
  $$insert into public.character_events (user_id, kind, ref_id, xp_delta)
    values ('00000000-0000-0000-0000-00000000000a', 'complete', '20000000-0000-0000-0000-000000000003', 10)$$,
  '23505', null, 'the same event can''t be recorded twice'
);

-- The checks from section 8.1.
select throws_ok(
  $$update public.profiles set hero_name = 'A'$$, '23514', null, 'hero names under 2 characters are refused'
);
select throws_ok(
  $$update public.habits set type = 'monthly'$$, '23514', null, 'unknown habit types are refused'
);
select throws_ok(
  $$update public.characters set gold = -1$$, '23514', null, 'gold can''t go below 0'
);
select throws_ok(
  $$insert into public.inventory (id, user_id, item_id, purchased_at) values
    (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'oak-shield', now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'oak-shield', now())$$,
  '23505', null, 'an item can be owned only once'
);

-- Deleting the account (section 9.6) removes every row that belongs to the player.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select (select count(*) from public.profiles) + (select count(*) from public.characters)
        + (select count(*) from public.habits) + (select count(*) from public.completions)
        + (select count(*) from public.character_events))::int,
  0,
  'deleting the account removes all of the player''s rows'
);

select * from finish();
rollback;
