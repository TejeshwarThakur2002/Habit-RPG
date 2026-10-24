// Pushing completions through `sync`: rewards worked out on the server, the checks of
// SCOPE.md section 8.3, undo, duplicates, and the event log replaying to the stored hero.

import { assert, assertEquals } from '@std/assert';

import {
  addDays,
  applyXp,
  baseValues,
  computeReward,
  heroStats,
  localDate,
  newHero,
  replayHero,
  xpToNext,
} from '../_shared/game-core/index.ts';
import { syncResponseSchema, type ServerChange } from '../_shared/shared/index.ts';
import {
  NO_STACK,
  callSync,
  completionChange,
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

const TZ = 'America/Toronto';
const today = () => localDate(Date.now(), TZ);
const at = (offsetMinutes = 0) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

interface Player extends TestUser {
  habit: string;
}

/** A player with a profile and one easy daily Body habit created two days ago. */
async function withPlayer(fn: (p: Player) => Promise<void>) {
  const user = await newUser();
  const habit = crypto.randomUUID();
  try {
    await push(user, [
      profileChange('Ada', TZ),
      habitChange(habit, at(), { category: 'body', created_date: addDays(today(), -2) }),
    ]);
    await fn({ ...user, habit });
  } finally {
    await deleteUser(user);
  }
}

async function push(user: TestUser, changes: unknown[]) {
  const res = await callSync(user.token, request(0, changes));
  assertEquals(res.status, 200, JSON.stringify(res.json));
  return syncResponseSchema.parse(res.json);
}

function completionIn(changes: ServerChange[], id: string) {
  const row = changes
    .filter((c) => c.table === 'completions' && c.op === 'upsert')
    .map((c) => c.data as { id: string })
    .findLast((r) => r.id === id);
  assert(row, `completion ${id} was not pulled`);
  return row as unknown as { xp_awarded: number; gold_awarded: number; undone_at: string | null };
}

/** The hero the player's character_events add up to. */
async function replayed(userId: string) {
  const sql = database();
  try {
    const rows = await sql`
      select xp_delta, gold_delta, hp_delta from public.character_events
      where user_id = ${userId} order by id`;
    return replayHero(rows.map((r) => ({ xp: r.xp_delta, gold: r.gold_delta, hp: r.hp_delta })));
  } finally {
    await sql.end();
  }
}

test('the reward is worked out on the server with game-core', async () => {
  await withPlayer(async (p) => {
    const id = crypto.randomUUID();
    const res = await push(p, [completionChange(id, p.habit, today(), at())]);
    assertEquals(res.applied, [id]);

    const stats = heroStats({ completionsByCategory: {}, longestStreakDays: 0, equipped: [] });
    const reward = computeReward({
      base: baseValues('daily', 'easy'),
      completionId: id,
      streakDays: 0,
      str: stats.STR,
      int: stats.INT,
      luck: stats.LUCK,
      bonusXpPercent: 0,
    });
    const row = completionIn(res.changes, id);
    assertEquals([row.xp_awarded, row.gold_awarded], [reward.xp, reward.gold]);
    const { hero } = applyXp(newHero(), reward.xp, stats.maxHp);
    assertEquals(res.character.xp_in_level, hero.xpInLevel);
    assertEquals(res.character.gold, hero.gold + reward.gold);
  });
});

test('a retried completion counts once', async () => {
  await withPlayer(async (p) => {
    const change = completionChange(crypto.randomUUID(), p.habit, today(), at());
    const first = await push(p, [change]);
    const again = await push(p, [change]);
    assertEquals(again.applied, [change.id]);
    assertEquals(again.character, first.character);
  });
});

test('undo takes the reward back once, and never lowers the level', async () => {
  await withPlayer(async (p) => {
    const sql = database();
    try {
      // One XP short of level 2, so this completion levels the hero up.
      await sql`update public.characters set xp_in_level = ${xpToNext(1) - 1}
                where user_id = ${p.id}`;
    } finally {
      await sql.end();
    }
    const id = crypto.randomUUID();
    const done = await push(p, [completionChange(id, p.habit, today(), at())]);
    assertEquals(done.character.level, 2);

    const undone = completionChange(id, p.habit, today(), at(), at(1));
    const res = await push(p, [undone]);
    assertEquals(res.character.level, 2);
    assertEquals(res.character.xp_in_level, 0);
    assert(completionIn(res.changes, id).undone_at !== null);
    assertEquals((await push(p, [undone])).character, res.character);
  });
});

test('dates outside today minus 2 to tomorrow are refused', async () => {
  await withPlayer(async (p) => {
    const old = completionChange(crypto.randomUUID(), p.habit, addDays(today(), -3), at());
    const ahead = completionChange(crypto.randomUUID(), p.habit, addDays(today(), 2), at());
    const res = await push(p, [old, ahead]);
    assertEquals(
      res.rejected.map((r) => r.reason),
      ['date_out_of_range', 'date_out_of_range'],
    );
  });
});

test('a day the habit was not scheduled, or did not exist yet, is refused', async () => {
  await withPlayer(async (p) => {
    const offDay = crypto.randomUUID();
    const newer = crypto.randomUUID();
    // Weekday bitmask Monday = 1 ... Sunday = 64: every day except today's.
    const todayBit = 1 << ((new Date(`${today()}T12:00:00Z`).getUTCDay() + 6) % 7);
    await push(p, [
      habitChange(offDay, at(), { type: 'weekdays', weekdays: 127 & ~todayBit }),
      habitChange(newer, at(), { created_date: addDays(today(), 1) }),
    ]);
    const res = await push(p, [
      completionChange(crypto.randomUUID(), offDay, today(), at()),
      completionChange(crypto.randomUUID(), newer, today(), at()),
    ]);
    assertEquals(
      res.rejected.map((r) => r.reason),
      ['not_scheduled', 'not_scheduled'],
    );
  });
});

test('of two completions for the same day, the earliest wins', async () => {
  await withPlayer(async (p) => {
    const later = completionChange(crypto.randomUUID(), p.habit, today(), at(-10));
    const earlier = completionChange(crypto.randomUUID(), p.habit, today(), at(-20));
    const latest = completionChange(crypto.randomUUID(), p.habit, today(), at(-5));
    await push(p, [later]);
    // The earlier one arrives second and replaces it; the later one is undone.
    const res = await push(p, [earlier, latest]);
    assertEquals(res.applied, [earlier.id]);
    assertEquals(res.rejected, [{ id: latest.id, table: 'completions', reason: 'duplicate' }]);
    assert(completionIn(res.changes, later.id).undone_at !== null);
    assertEquals(completionIn(res.changes, earlier.id).undone_at, null);
  });
});

test("another player's habit can't be completed", async () => {
  await withPlayer(async (a) => {
    await withPlayer(async (b) => {
      const change = completionChange(crypto.randomUUID(), a.habit, today(), at());
      const res = await push(b, [change]);
      assertEquals(res.rejected, [{ id: change.id, table: 'completions', reason: 'invalid' }]);
    });
  });
});

test('a completion for a day that already closed is late and gets no streak bonus', async () => {
  await withPlayer(async (p) => {
    const yesterday = addDays(today(), -1);
    const sql = database();
    try {
      await sql`update public.characters
                set last_closed_date = ${yesterday}, current_streak = 10
                where user_id = ${p.id}`;
    } finally {
      await sql.end();
    }
    const id = crypto.randomUUID();
    const res = await push(p, [completionChange(id, p.habit, yesterday, at())]);
    const stats = heroStats({ completionsByCategory: {}, longestStreakDays: 0, equipped: [] });
    const input = {
      base: baseValues('daily', 'easy'),
      completionId: id,
      streakDays: 10,
      str: stats.STR,
      int: stats.INT,
      luck: stats.LUCK,
      bonusXpPercent: 0,
    };
    const row = completionIn(res.changes, id) as unknown as {
      is_late: boolean;
      xp_awarded: number;
    };
    assertEquals(row.is_late, true);
    assertEquals(row.xp_awarded, computeReward({ ...input, isLate: true }).xp);
    assert(row.xp_awarded < computeReward(input).xp);
  });
});

test('the event log replays to exactly the stored hero', async () => {
  await withPlayer(async (p) => {
    const habits = [p.habit, crypto.randomUUID(), crypto.randomUUID()];
    await push(p, [
      habitChange(habits[1]!, at(), { category: 'mind', created_date: addDays(today(), -2) }),
      habitChange(habits[2]!, at(), {
        difficulty: 'hard',
        category: 'health',
        created_date: addDays(today(), -2),
      }),
    ]);
    // Every habit on each of the last three days, then three of them undone.
    const done: { id: string; habit: string; date: string }[] = [];
    for (const offset of [-2, -1, 0]) {
      for (const habit of habits) {
        const entry = { id: crypto.randomUUID(), habit, date: addDays(today(), offset) };
        done.push(entry);
        await push(p, [completionChange(entry.id, habit, entry.date, at(offset * 60))]);
      }
    }
    for (const { id, habit, date } of [done[1]!, done[4]!, done[8]!]) {
      await push(p, [completionChange(id, habit, date, at(), at(2))]);
    }
    const res = await push(p, []);
    const hero = await replayed(p.id);
    assertEquals(
      { level: hero.level, xp_in_level: hero.xpInLevel, hp: hero.hp, gold: hero.gold },
      {
        level: res.character.level,
        xp_in_level: res.character.xp_in_level,
        hp: res.character.hp,
        gold: res.character.gold,
      },
    );
    assert(res.character.gold > 0);
  });
});
