// Keeping a phone's hero over the account's (D48, D49): an import with `replace` deletes the
// account's game data and imports the phone's, and phones still holding the old hero are told
// to start again. Also: only the phone that started an import may continue it.

import { assertEquals } from '@std/assert';

import { addDays, localDate, zonedInstant } from '../_shared/game-core/index.ts';
import {
  syncRefusalSchema,
  syncResponseSchema,
  type SyncResponse,
} from '../_shared/shared/index.ts';
import {
  NO_STACK,
  callSync,
  completionChange,
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

const TZ = 'America/Toronto';
const today = () => localDate(Date.now(), TZ);
const day = (offset: number) => addDays(today(), offset);
const at = (offset: number, hour: number) =>
  new Date(zonedInstant(day(offset), hour, 0, TZ)).toISOString();
const minuteAgo = () => new Date(Date.now() - 60_000).toISOString();

/** The phone that keeps its own hero; `request()` is the other phone. */
const PHONE_B = '3f1c2b9e-8d47-4a6e-9c15-2b7e0d4f6a83';
const STARTED = () => at(-6, 12);

const fromB = (changes: unknown[], done: boolean, replace = true) => ({
  ...request(0, changes),
  device_id: PHONE_B,
  import: { started_at: STARTED(), done, replace },
});

async function withUser(fn: (user: TestUser) => Promise<void>) {
  const user = await newUser();
  try {
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

async function send(user: TestUser, body: unknown): Promise<SyncResponse> {
  const res = await callSync(user.token, body);
  assertEquals(res.status, 200, JSON.stringify(res.json));
  return syncResponseSchema.parse(res.json);
}

/** A sync the server refused as a whole, with the code it gave. */
async function refused(user: TestUser, body: unknown, status: number) {
  const res = await callSync(user.token, body);
  assertEquals(res.status, status, JSON.stringify(res.json));
  return syncRefusalSchema.parse(res.json).error;
}

/** The account's hero "Ada" from the first phone: a quest, a completion and a purchase. */
async function accountHero(user: TestUser): Promise<SyncResponse> {
  const quest = crypto.randomUUID();
  await send(user, request(0, [profileChange('Ada', TZ)]));
  await grant(user.id, { gold: 100 });
  return await send(
    user,
    request(0, [
      habitChange(quest, minuteAgo(), { created_date: day(-1) }),
      completionChange(crypto.randomUUID(), quest, today(), minuteAgo()),
      gearChange(crypto.randomUUID(), 'oak-shield', minuteAgo()),
    ]),
  );
}

/** Phone B's hero "Bea", made six days ago with one quest done twice. */
function beaChanges(quest = crypto.randomUUID()) {
  return [
    profileChange('Bea', TZ),
    habitChange(quest, STARTED(), { created_date: day(-6) }),
    completionChange(crypto.randomUUID(), quest, day(-6), at(-6, 20)),
    completionChange(crypto.randomUUID(), quest, day(-5), at(-5, 20)),
  ];
}

async function rowsOf(userId: string) {
  const sql = database();
  try {
    const [rows] = await sql`
      select
        (select hero_name from public.profiles where id = ${userId}) as hero,
        (select count(*)::int from public.habits where user_id = ${userId}) as habits,
        (select count(*)::int from public.completions where user_id = ${userId}) as completions,
        (select count(*)::int from public.inventory where user_id = ${userId}) as inventory,
        (select count(*)::int from auth.users where id = ${userId}) as logins`;
    return rows;
  } finally {
    await sql.end();
  }
}

test("keeping this phone's hero replaces the account's game data, never its login", async () => {
  await withUser(async (user) => {
    await accountHero(user);
    const res = await send(user, fromB(beaChanges(), true));
    assertEquals(res.rejected, []);

    assertEquals(await rowsOf(user.id), {
      hero: 'Bea',
      habits: 1,
      completions: 2,
      inventory: 0,
      logins: 1,
    });
    // Ada's events went with her: the event log adds up to Bea alone.
    const hero = await replayed(user.id);
    assertEquals(
      [hero.xpInLevel, hero.hp, hero.gold],
      [res.character.xp_in_level, res.character.hp, res.character.gold],
    );
  });
});

test('a replacing import over several syncs only replaces on its first', async () => {
  await withUser(async (user) => {
    await accountHero(user);
    const [profile, quest, first, second] = beaChanges();
    await send(user, fromB([profile, quest, first], false));
    await send(user, fromB([second], true));
    assertEquals(await rowsOf(user.id), {
      hero: 'Bea',
      habits: 1,
      completions: 2,
      inventory: 0,
      logins: 1,
    });
  });
});

test('a phone still holding the replaced hero is told to start again', async () => {
  await withUser(async (user) => {
    const old = await accountHero(user);
    await send(user, fromB(beaChanges(), true));

    const stale = { ...request(old.cursor), changes: [profileChange('Ada again', TZ)] };
    assertEquals(await refused(user, stale, 409), 'hero_replaced');
    assertEquals((await rowsOf(user.id)).hero, 'Bea');

    // Starting again from 0 brings Bea, and syncing on from there is ordinary.
    const fresh = await send(user, request(0));
    const names = fresh.changes.flatMap((c) =>
      c.table === 'profiles' && c.op === 'upsert' ? [c.data.hero_name] : [],
    );
    assertEquals(names, ['Bea']);
    await send(user, request(fresh.cursor));
  });
});

test("a replace has to start with the new hero's profile, or nothing changes", async () => {
  await withUser(async (user) => {
    await accountHero(user);
    const [profile, quest] = beaChanges();
    assertEquals(await refused(user, fromB([quest, profile], true), 400), 'bad_import');
    assertEquals((await rowsOf(user.id)).hero, 'Ada');
  });
});

test('only the phone that started an import may continue it', async () => {
  await withUser(async (user) => {
    const [profile, quest, first, second] = beaChanges();
    await send(user, fromB([profile, quest, first], false, false));

    const other = { ...fromB([second], true), device_id: request(0).device_id };
    assertEquals(await refused(user, other, 409), 'import_in_progress');
    await send(user, fromB([second], true, false));
    assertEquals((await rowsOf(user.id)).completions, 2);
  });
});
