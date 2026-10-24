// The `delete-account` function (SCOPE.md F10, section 9.6): a player can delete their own
// account and everything in it, and nobody else's.

import { assertEquals } from '@std/assert';

import {
  API_URL,
  AT,
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
import { localDate } from '../_shared/game-core/index.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

async function callDelete(token: string | null) {
  const res = await fetch(`${API_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, json: await res.json() };
}

/** A player with a hero, a quest and a completion on the server. */
async function playerWithData(): Promise<TestUser> {
  const user = await newUser();
  const habit = crypto.randomUUID();
  const now = new Date().toISOString();
  const res = await callSync(
    user.token,
    request(0, [
      profileChange('Ada'),
      habitChange(habit, AT),
      completionChange(crypto.randomUUID(), habit, localDate(Date.now(), 'America/Toronto'), now),
    ]),
  );
  assertEquals(res.status, 200, JSON.stringify(res.json));
  return user;
}

/** Every row the player owns, across the player tables and the auth account. */
async function rowsOf(userId: string): Promise<number> {
  const sql = database();
  try {
    const [{ n }] = await sql`
      select (select count(*) from auth.users where id = ${userId})
           + (select count(*) from public.profiles where id = ${userId})
           + (select count(*) from public.characters where user_id = ${userId})
           + (select count(*) from public.habits where user_id = ${userId})
           + (select count(*) from public.completions where user_id = ${userId})
           + (select count(*) from public.character_events where user_id = ${userId}) as n`;
    return Number(n);
  } finally {
    await sql.end();
  }
}

test('deleting needs a signed-in player', async () => {
  assertEquals((await callDelete(null)).status, 401);
});

test("a player's deletion removes their account and every row, and nobody else's", async () => {
  const [ada, bea] = [await playerWithData(), await playerWithData()];
  try {
    assertEquals((await rowsOf(ada.id)) > 0, true);
    const res = await callDelete(ada.token);
    assertEquals(res, { status: 200, json: { deleted: true } });
    assertEquals(await rowsOf(ada.id), 0);
    // Bea's hero, quest, completion and events are untouched.
    assertEquals(await rowsOf(bea.id), 1 + 1 + 1 + 1 + 1 + 1);
  } finally {
    await deleteUser(ada);
    await deleteUser(bea);
  }
});
