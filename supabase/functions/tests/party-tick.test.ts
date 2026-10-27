// The nightly job's party work (SCOPE.md sections 9.2 and 9.3; D59): the boss's hits in the
// battle log, the Monday rollover in each party's time zone (daylight-saving days and an outage
// included), removing parties left empty for a week, and the job doing it once.

import { assert, assertEquals } from '@std/assert';

import { localDate, zonedInstant } from '../_shared/game-core/index.ts';
import { bossAttacks, removeEmptyParties, rolloverBosses } from '../daily-tick/parties.ts';
import {
  API_URL,
  AT,
  NO_STACK,
  callSync,
  database,
  deleteUser,
  habitChange,
  newUser,
  profileChange,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

const LA = 'America/Los_Angeles';
const AUCKLAND = 'Pacific/Auckland';
const at = (date: string, hour: number, minute: number, zone: string) =>
  new Date(zonedInstant(date, hour, minute, zone));

async function query<T>(fn: (sql: ReturnType<typeof database>) => Promise<T>): Promise<T> {
  const sql = database();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** A party in `zone` with `count` members and one boss row starting on `start`. */
async function withParty(
  zone: string,
  count: number,
  start: string,
  fn: (party: string, users: TestUser[]) => Promise<void>,
) {
  const users: TestUser[] = [];
  try {
    for (let i = 0; i < count; i++) users.push(await newUser());
    const [{ id }] = await query(
      (sql) => sql`
      insert into public.parties (name, code, timezone)
      values ('Owls', ${randomCode()}, ${zone}) returning id`,
    );
    await query(async (sql) => {
      for (const user of users) {
        await sql`insert into public.party_members (party_id, user_id) values (${id}, ${user.id})`;
      }
      await sql`
        insert into public.boss_weeks (party_id, week_start, boss_key, max_hp, current_hp)
        values (${id}, ${start}, 'procrastination-slime', 500, 500)`;
    });
    await fn(id as string, users);
    await query((sql) => sql`delete from public.parties where id = ${id}`);
  } finally {
    for (const user of users) await deleteUser(user);
  }
}

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * 32)]).join('');
}

const bosses = (party: string) =>
  query(
    (sql) => sql`
    select week_start::text as week_start, boss_key, max_hp from public.boss_weeks
    where party_id = ${party} order by boss_weeks.week_start`,
  );
const roll = (now: Date) => query((sql) => rolloverBosses(sql, now));

test("the boss's hits: one line per missed quest that cost HP, blocked misses none", async () => {
  await withParty(LA, 1, '2026-10-26', async (party, [user]) => {
    const quest = crypto.randomUUID();
    const shielded = crypto.randomUUID();
    await callSync(
      user!.token,
      request(0, [
        profileChange('Ada', LA),
        habitChange(quest, AT, { name: 'Gym' }),
        habitChange(shielded, AT, { name: 'Swim' }),
      ]),
    );
    await query(
      (sql) => sql`
      insert into public.day_closures (user_id, local_date, hp_lost, missed) values
        (${user!.id}, '2026-10-27', 6, ${sql.json([
          { habitId: quest, hpLoss: 6, blocked: false, slip: false },
          { habitId: shielded, hpLoss: 6, blocked: true, slip: false },
        ] as never)}),
        (${user!.id}, '2026-10-19', 6, ${sql.json([
          { habitId: quest, hpLoss: 6, blocked: false, slip: false },
        ] as never)})`,
    );
    // The 19th falls in no boss week of this party: no line for it.
    await query((sql) =>
      sql.begin((tx) => bossAttacks(tx, user!.id, ['2026-10-27', '2026-10-19'])),
    );
    const lines = await query(
      (sql) => sql`
      select kind, amount, habit_name, user_id from public.party_events where party_id = ${party}`,
    );
    assertEquals(
      [...lines],
      [{ kind: 'boss_attack', amount: 6, habit_name: 'Gym', user_id: user!.id }],
    );
  });
});

test("Monday starts the next boss in the party's own time zone, with HP for its members", async () => {
  await withParty(AUCKLAND, 2, '2026-10-26', async (party) => {
    // Sunday 23:30 in Auckland: still last week there.
    await roll(at('2026-11-01', 23, 30, AUCKLAND));
    assertEquals((await bosses(party)).length, 1);
    await roll(at('2026-11-02', 0, 30, AUCKLAND));
    await roll(at('2026-11-02', 0, 45, AUCKLAND));
    assertEquals(
      [...(await bosses(party))],
      [
        { week_start: '2026-10-26', boss_key: 'procrastination-slime', max_hp: 500 },
        { week_start: '2026-11-02', boss_key: 'snooze-goblin', max_hp: 1000 },
      ],
    );
  });
});

test('across the daylight-saving change, and after an outage only this week starts', async () => {
  // Los Angeles falls back on Sunday 1 November 2026.
  await withParty(LA, 1, '2026-10-26', async (party) => {
    await roll(at('2026-11-01', 23, 30, LA));
    assertEquals((await bosses(party)).length, 1);
    await roll(at('2026-11-02', 0, 5, LA));
    assertEquals(
      (await bosses(party)).map((b) => b.week_start),
      ['2026-10-26', '2026-11-02'],
    );
  });
  await withParty(LA, 1, '2026-10-05', async (party) => {
    await roll(at('2026-10-28', 12, 0, LA));
    assertEquals((await bosses(party)).slice(-1), [
      { week_start: '2026-10-26', boss_key: 'snooze-goblin', max_hp: 500 },
    ]);
  });
});

test('an empty party gets no boss, and goes a week after its last member left', async () => {
  await withParty(LA, 2, '2026-10-26', async (party, [a, b]) => {
    const leave = (user: TestUser, daysAgo: number) =>
      query(
        (sql) => sql`
        update public.party_members set left_at = now() - ${`${daysAgo} days`}::interval
        where party_id = ${party} and user_id = ${user.id}`,
      );
    await leave(a!, 9);
    await query((sql) => removeEmptyParties(sql, new Date()));
    assertEquals((await bosses(party)).length, 1, 'one member is still in it');

    await leave(b!, 6);
    await roll(at('2026-11-02', 12, 0, LA));
    assertEquals((await bosses(party)).length, 1, 'nobody in it, so no new boss');
    await query((sql) => removeEmptyParties(sql, new Date()));
    assertEquals((await bosses(party)).length, 1, 'six days is too soon');

    await leave(b!, 8);
    await query((sql) => removeEmptyParties(sql, new Date()));
    const [left] = await query(
      (sql) => sql`select count(*)::int as n from public.parties where id = ${party}`,
    );
    assertEquals(left!.n, 0);
  });
});

test('the job narrates a closed day once for a party member', async () => {
  await withParty(LA, 1, localDate(Date.now() - 86_400_000 * 7, LA), async (party, [user]) => {
    const quest = crypto.randomUUID();
    await callSync(
      user!.token,
      request(0, [
        profileChange('Ada', LA),
        habitChange(quest, AT, { name: 'Gym', created_date: '2026-01-01' }),
      ]),
    );
    // Last week's and this week's bosses, so the two days closed both fall in a boss week.
    await query(
      (sql) => sql`
      update public.boss_weeks
      set week_start = ${localDate(Date.now(), LA)}::date
        - (extract(isodow from ${localDate(Date.now(), LA)}::date)::int - 1) - 7
      where party_id = ${party};
      `,
    );
    await query(
      (sql) => sql`
      insert into public.boss_weeks (party_id, week_start, boss_key, max_hp, current_hp)
      select party_id, week_start + 7, 'snooze-goblin', 500, 500 from public.boss_weeks
      where party_id = ${party}`,
    );
    await query(
      (sql) => sql`
      update public.profiles set created_at = now() - interval '2 days' where id = ${user!.id}`,
    );
    const tick = async () => {
      const res = await fetch(`${API_URL}/functions/v1/daily-tick`, {
        method: 'POST',
        headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' },
      });
      assertEquals(res.status, 200);
      return await res.json();
    };
    await tick();
    const count = async () =>
      (
        await query(
          (sql) => sql`
          select count(*)::int as n from public.party_events
          where party_id = ${party} and kind = 'boss_attack'`,
        )
      )[0]!.n;
    const first = await count();
    assert(first >= 1, 'the closed days were narrated');
    await tick();
    assertEquals(await count(), first);
  });
});
