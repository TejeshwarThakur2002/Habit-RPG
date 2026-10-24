// The server's day close (SCOPE.md section 9.3) and the `daily-tick` function that runs it.
// closeDays takes the time as an argument, so these tests can stand on any morning, including
// the daylight-saving days in Auckland and Los Angeles (section 13).

import { assertEquals } from '@std/assert';

import { latestClosableDate, newHero, zonedInstant } from '../_shared/game-core/index.ts';
import { closeDays } from '../_server/close-days.ts';
import {
  API_URL,
  AT,
  NO_STACK,
  callSync,
  database,
  deleteUser,
  gearChange,
  grant,
  habitChange,
  newUser,
  profileChange,
  replayed,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

const LA = 'America/Los_Angeles';
const AUCKLAND = 'Pacific/Auckland';

/** A player who signed up at noon on `start` in `zone`, with these quests (created that day). */
async function withPlayer(
  zone: string,
  start: string,
  habits: { id: string; data?: Record<string, unknown> }[],
  fn: (p: TestUser) => Promise<void>,
) {
  const user = await newUser();
  try {
    const changes = habits.map((h) => habitChange(h.id, AT, { created_date: start, ...h.data }));
    const res = await callSync(user.token, request(0, [profileChange('Ada', zone), ...changes]));
    assertEquals(res.status, 200, JSON.stringify(res.json));
    await query(
      (sql) => sql`
      update public.profiles set created_at = ${new Date(zonedInstant(start, 12, 0, zone))}
      where id = ${user.id}`,
    );
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

async function query<T>(fn: (sql: ReturnType<typeof database>) => Promise<T>): Promise<T> {
  const sql = database();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

const close = (userId: string, at: string) =>
  query((sql) => sql.begin((tx) => closeDays(tx, userId, new Date(at))));

async function heroOf(userId: string) {
  const [row] = await query(
    (sql) => sql`
    select level, xp_in_level, hp, gold, current_streak, longest_streak,
           last_closed_date::text as last_closed_date
    from public.characters where user_id = ${userId}`,
  );
  return row!;
}

/** The stored hero must always be what its event log adds up to (D38). */
async function assertReplays(userId: string) {
  const [hero, sum] = await Promise.all([heroOf(userId), replayed(userId)]);
  assertEquals(
    [hero.level, hero.xp_in_level, hero.hp, hero.gold],
    [sum.level, sum.xpInLevel, sum.hp, sum.gold],
  );
}

const done = (userId: string, habitId: string, date: string) =>
  query(
    (sql) => sql`
    insert into public.completions (id, user_id, habit_id, local_date, completed_at, category,
                                    xp_awarded, gold_awarded, boss_damage)
    values (${crypto.randomUUID()}, ${userId}, ${habitId}, ${date}, now(), 'mind', 0, 0, 0)`,
  );

test('a closed day costs HP for missed quests, less what gear blocks, and moves the streak', async () => {
  const [read, run, stretch] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const quests = [
    { id: read },
    { id: run, data: { difficulty: 'hard' } },
    { id: stretch, data: { difficulty: 'medium' } },
  ];
  await withPlayer(LA, '2026-03-02', quests, async (p) => {
    await grant(p.id, { gold: 40 });
    const shield = gearChange(crypto.randomUUID(), 'oak-shield', AT, true);
    assertEquals((await callSync(p.token, request(0, [shield]))).json.applied, [shield.id]);
    await done(p.id, read, '2026-03-02');

    // 03:00 the next morning in Los Angeles (PST, UTC-8).
    assertEquals(await close(p.id, '2026-03-03T11:00:00Z'), ['2026-03-02']);
    // The shield blocks the costliest miss (hard, 8 HP); the medium one costs 6.
    const hero = await heroOf(p.id);
    assertEquals(
      [hero.hp, hero.current_streak, hero.last_closed_date],
      [newHero().hp - 6, 1, '2026-03-02'],
    );
    const [closure] = await query(
      (sql) => sql`
      select hp_lost, missed from public.day_closures where user_id = ${p.id}`,
    );
    assertEquals(closure!.hp_lost, 6);
    const missed = closure!.missed as { habitId: string; blocked: boolean }[];
    assertEquals(Object.fromEntries(missed.map((m) => [m.habitId, m.blocked])), {
      [run]: true,
      [stretch]: false,
    });
    await assertReplays(p.id);
  });
});

test("a day closes at 03:00 in the player's zone, on both daylight-saving days", async () => {
  // [zone, day to close, 02:59 the next morning, 03:00 the next morning]
  const cases = [
    [LA, '2026-03-07', '2026-03-08T09:59:00Z', '2026-03-08T10:00:00Z'], // 02:00 skipped
    [LA, '2026-10-31', '2026-11-01T10:59:00Z', '2026-11-01T11:00:00Z'], // 01:00 twice
    [AUCKLAND, '2026-04-04', '2026-04-04T14:59:00Z', '2026-04-04T15:00:00Z'], // 02:00 twice
    [AUCKLAND, '2026-09-26', '2026-09-26T13:59:00Z', '2026-09-26T14:00:00Z'], // 02:00 skipped
  ] as const;
  for (const [zone, day, before, at] of cases) {
    await withPlayer(zone, day, [], async (p) => {
      assertEquals(await close(p.id, before), [], `${zone} ${day} closed too early`);
      assertEquals(await close(p.id, at), [day], `${zone} ${day} not closed at 03:00`);
    });
  }
});

test('a three-day outage closes each day in order, and running again changes nothing', async () => {
  const habit = crypto.randomUUID();
  await withPlayer(AUCKLAND, '2026-05-04', [{ id: habit }], async (p) => {
    // The job comes back at 04:00 on 7 May in Auckland (NZST, UTC+12).
    const at = '2026-05-06T16:00:00Z';
    assertEquals(await close(p.id, at), ['2026-05-04', '2026-05-05', '2026-05-06']);
    const after = await heroOf(p.id);
    assertEquals([after.hp, after.current_streak], [newHero().hp - 3 * 4, 0]);

    assertEquals(await close(p.id, at), []);
    assertEquals(await close(p.id, '2026-05-06T17:00:00Z'), []);
    assertEquals(await heroOf(p.id), after);
    const [{ n }] = await query(
      (sql) => sql`
      select count(*)::int as n from public.day_closures where user_id = ${p.id}`,
    );
    assertEquals(n, 3);
    await assertReplays(p.id);
  });
});

test('reaching 0 HP faints the hero: a quarter of the gold and the level XP go', async () => {
  const habit = crypto.randomUUID();
  await withPlayer(LA, '2026-06-01', [{ id: habit, data: { difficulty: 'hard' } }], async (p) => {
    await grant(p.id, { gold: 100, xp: 30, hp: 4 - newHero().hp });
    await close(p.id, '2026-06-02T10:00:00Z');
    const hero = await heroOf(p.id);
    assertEquals(
      [hero.level, hero.xp_in_level, hero.hp, hero.gold],
      [1, 0, Math.floor(newHero().hp / 2), 75],
    );
    await assertReplays(p.id);
  });
});

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

async function callTick(secret: string | null) {
  const res = await fetch(`${API_URL}/functions/v1/daily-tick`, {
    method: 'POST',
    headers: secret === null ? {} : { 'x-cron-secret': secret },
  });
  return { status: res.status, json: await res.json() };
}

test('the job refuses a call without the cron secret', async () => {
  assertEquals((await callTick(null)).status, 401);
  assertEquals((await callTick('not-the-secret')).status, 401);
});

test('the job closes the finished days of every player who is due, once', async () => {
  const zone = 'America/Toronto';
  await withPlayer(zone, '2026-10-01', [], async (p) => {
    // Signed up three days ago, never closed.
    await query(
      (sql) => sql`
      update public.profiles set created_at = now() - interval '3 days' where id = ${p.id}`,
    );
    const first = await callTick(CRON_SECRET);
    assertEquals(first.status, 200, JSON.stringify(first.json));
    const hero = await heroOf(p.id);
    assertEquals(hero.last_closed_date, latestClosableDate(Date.now(), zone));

    await callTick(CRON_SECRET);
    assertEquals(await heroOf(p.id), hero);
  });
});
