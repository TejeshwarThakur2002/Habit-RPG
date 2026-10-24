// The `sync` Edge Function, called over HTTP on the local stack (SCOPE.md section 8.3).

import { assert, assertEquals, assertObjectMatch } from '@std/assert';

import { syncResponseSchema, type ServerChange } from '../_shared/shared/index.ts';
import {
  AT,
  NO_STACK,
  callSync,
  database,
  deleteUser,
  newUser,
  profileChange,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

/** The profile row in a pulled change, failing the test if it is anything else. */
function profileOf(change: ServerChange | undefined) {
  assert(change?.table === 'profiles' && change.op === 'upsert', 'expected a profile');
  return change.data;
}

/** Runs `fn` with a fresh signed-in player, deleted afterwards. */
async function withUser(fn: (user: TestUser) => Promise<void>) {
  const user = await newUser();
  try {
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

test('refuses a call without a signed-in user', async () => {
  const { status } = await callSync(null, request(0));
  assertEquals(status, 401);
});

test('refuses bad requests without echoing what was sent', async () => {
  await withUser(async ({ token }) => {
    assertEquals((await callSync(token, 'not json')).status, 400);
    const bad = await callSync(token, request(0, [profileChange('A')]));
    assertEquals(bad.status, 400);
    assertEquals(bad.json.issues, ['changes.0.data.hero_name: too_small']);
    assertEquals((await callSync(token, 'x'.repeat(300 * 1024))).status, 413);
  });
});

test('the first push creates the server profile and a brand-new hero', async () => {
  await withUser(async ({ id, token }) => {
    const first = await callSync(token, request(0, [profileChange(' Ada ')]));
    assertEquals(first.status, 200);
    const body = syncResponseSchema.parse(first.json);
    assertEquals(body.applied, ['me']);
    assertEquals(body.changes.length, 1);
    assertObjectMatch(profileOf(body.changes[0]), { id, hero_name: 'Ada', class: 'mage' });
    assertEquals(body.character, {
      level: 1,
      xp_in_level: 0,
      hp: 44,
      gold: 0,
      current_streak: 0,
      longest_streak: 0,
      last_closed_date: null,
    });

    // Nothing new since that cursor; then a rename comes back with a higher server_seq.
    const again = syncResponseSchema.parse((await callSync(token, request(body.cursor))).json);
    assertEquals(again.changes, []);
    assertEquals(again.cursor, body.cursor);
    const renamed = syncResponseSchema.parse(
      (
        await callSync(
          token,
          request(body.cursor, [profileChange('Ada Lovelace', 'Europe/London')]),
        )
      ).json,
    );
    assert(renamed.cursor > body.cursor);
    assertObjectMatch(profileOf(renamed.changes[0]), {
      hero_name: 'Ada Lovelace',
      timezone: 'Europe/London',
    });
  });
});

test('pulls 500 rows at a time, oldest first, and never another player’s rows', async () => {
  const sql = database();
  try {
    await withUser(async (a) => {
      await withUser(async (b) => {
        for (const user of [a, b]) {
          await callSync(user.token, request(0, [profileChange('Hero')]));
          await sql`
            insert into public.habits
              (id, user_id, name, type, difficulty, created_date, client_updated_at)
            select gen_random_uuid(), ${user.id}, 'Quest ' || n, 'daily', 'easy',
                   '2026-10-20', ${AT}
            from generate_series(1, 501) as n`;
        }
        const page1 = syncResponseSchema.parse((await callSync(a.token, request(0))).json);
        assertEquals(page1.changes.length, 500);
        assertEquals(page1.has_more, true);
        const seqs = page1.changes.map((c) => (c.op === 'upsert' ? c.data.server_seq : 0));
        assertEquals(
          seqs,
          [...seqs].sort((x, y) => x - y),
        );
        assertEquals(page1.cursor, seqs.at(-1));

        const page2 = syncResponseSchema.parse(
          (await callSync(a.token, request(page1.cursor))).json,
        );
        assertEquals(page2.changes.length, 2);
        assertEquals(page2.has_more, false);

        // Exactly A's 501 habits came back (B's 501 never did), each once.
        const pulled = [...page1.changes, ...page2.changes]
          .filter((c) => c.table === 'habits' && c.op === 'upsert')
          .map((c) => (c.op === 'upsert' ? (c.data as { id: string }).id : ''))
          .sort();
        const mine = (await sql`select id from public.habits where user_id = ${a.id}`)
          .map((r) => r.id as string)
          .sort();
        assertEquals(pulled, mine);
      });
    });
  } finally {
    await sql.end();
  }
});
