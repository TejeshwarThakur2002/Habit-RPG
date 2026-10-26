// Importing a linked local hero through `sync` (D35, D42): the server replays the phone's
// history in time order, closing each day as it goes, and works out the hero itself.

import { assert, assertEquals } from '@std/assert';

import {
  addDays,
  latestClosableDate,
  localDate,
  newHero,
  zonedInstant,
} from '../_shared/game-core/index.ts';
import { syncResponseSchema } from '../_shared/shared/index.ts';
import {
  NO_STACK,
  callSync,
  completionChange,
  database,
  deleteUser,
  gearChange,
  habitChange,
  newUser,
  profileChange,
  replayed,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

const TZ = 'America/Toronto';
const today = () => localDate(Date.now(), TZ);
const day = (offset: number) => addDays(today(), offset);
/** `hour`:00 on the day `offset` days from today, in Toronto. */
const at = (offset: number, hour: number) =>
  new Date(zonedInstant(day(offset), hour, 0, TZ)).toISOString();

/** The phone made the hero at noon six days ago. */
const STARTED = () => at(-6, 12);

const importing = (changes: unknown[], done: boolean, startedAt = STARTED()) => ({
  ...request(0, changes),
  import: { started_at: startedAt, done },
});

async function withUser(fn: (user: TestUser) => Promise<void>) {
  const user = await newUser();
  try {
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

async function send(user: TestUser, body: unknown, status = 200) {
  const res = await callSync(user.token, body);
  assertEquals(res.status, status, JSON.stringify(res.json));
  return status === 200 ? syncResponseSchema.parse(res.json) : res.json;
}

test("a linked hero's history is rebuilt by the server, day by day", async () => {
  await withUser(async (user) => {
    const habit = crypto.randomUUID();
    const done = [-6, -5, -3].map((offset) =>
      completionChange(crypto.randomUUID(), habit, day(offset), at(offset, 20)),
    );
    // Completed and undone on the phone: kept for the record, no effect.
    const undone = completionChange(crypto.randomUUID(), habit, day(-2), at(-2, 20), at(-2, 21));
    await send(
      user,
      importing(
        [
          profileChange('Ada', TZ),
          habitChange(habit, STARTED(), { created_date: day(-6) }),
          done[0],
          done[1],
        ],
        false,
      ),
    );
    const res = await send(user, importing([done[2], undone], true));
    assertEquals(res.rejected, []);

    // Every closed day without a completion cost the easy quest's 4 HP.
    const lastClosed = latestClosableDate(Date.now(), TZ);
    const closed: string[] = [];
    for (let d = day(-6); d <= lastClosed; d = addDays(d, 1)) closed.push(d);
    const missed = closed.filter((d) => ![day(-6), day(-5), day(-3)].includes(d));
    assertEquals(res.character.last_closed_date, lastClosed);
    assertEquals(res.character.hp, newHero().hp - 4 * missed.length);
    assertEquals([res.character.longest_streak, res.character.current_streak], [2, 0]);
    assert(res.character.xp_in_level > 0);

    const hero = await replayed(user.id);
    assertEquals(
      [hero.xpInLevel, hero.hp, hero.gold],
      [res.character.xp_in_level, res.character.hp, res.character.gold],
    );
    // Done: ordinary syncs work again.
    await send(user, request(res.cursor));
  });
});

test("an import only reaches an account that has no hero yet, and is told the account's", async () => {
  await withUser(async (user) => {
    await send(user, request(0, [profileChange('Ada', TZ)]));
    const res = await send(user, importing([profileChange('Bea', TZ)], true), 409);
    assertEquals(res, {
      error: 'hero_exists',
      hero: { hero_name: 'Ada', class: 'mage', level: 1 },
    });
  });
});

test('while an import is running, ordinary syncs wait for it', async () => {
  await withUser(async (user) => {
    await send(user, importing([profileChange('Ada', TZ)], false));
    assertEquals(await send(user, request(0), 409), { error: 'import_in_progress' });
    await send(user, importing([], true));
    await send(user, request(0));
  });
});

test('nothing in an import may be dated after now, and gold is what was earned by then', async () => {
  await withUser(async (user) => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await send(user, importing([], false, later), 400);

    const habit = crypto.randomUUID();
    const future = completionChange(crypto.randomUUID(), habit, today(), later);
    // Bought on day one, before any gold was earned.
    const shield = gearChange(crypto.randomUUID(), 'oak-shield', at(-6, 13));
    const res = await send(
      user,
      importing(
        [
          profileChange('Ada', TZ),
          habitChange(habit, STARTED(), { created_date: day(-6) }),
          shield,
          future,
        ],
        true,
      ),
    );
    assertEquals(
      res.rejected.map((r: { reason: string }) => r.reason),
      ['insufficient_gold', 'date_out_of_range'],
    );
    const sql = database();
    try {
      const [{ n }] = await sql`
        select count(*)::int as n from public.completions where user_id = ${user.id}`;
      assertEquals(n, 0);
    } finally {
      await sql.end();
    }
  });
});

test('a completion made after its day had closed is replayed as late', async () => {
  await withUser(async (user) => {
    const habit = crypto.randomUUID();
    // For day -4, ticked at 05:00 the next morning, after the 03:00 close.
    const late = completionChange(crypto.randomUUID(), habit, day(-4), at(-3, 5));
    const res = await send(
      user,
      importing(
        [profileChange('Ada', TZ), habitChange(habit, STARTED(), { created_date: day(-6) }), late],
        true,
      ),
    );
    const row = res.changes.find(
      (c: { table: string; data?: { id?: string } }) =>
        c.table === 'completions' && c.data?.id === late.id,
    );
    assertEquals((row?.data as { is_late?: boolean } | undefined)?.is_late, true);
  });
});
