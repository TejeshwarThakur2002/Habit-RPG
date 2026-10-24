// The P3 round trip (SCOPE.md section 11, P3 "done when"): one player through the whole
// backend on the running stack. Phone A pushes, phone B pulls the same rows and hero, the
// nightly job closes a day and changes nothing when it runs again, and deleting the account
// removes everything.

import { assert, assertEquals } from '@std/assert';

import { localDate } from '../_shared/game-core/index.ts';
import { syncResponseSchema } from '../_shared/shared/index.ts';
import {
  API_URL,
  AT,
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
} from './helpers.ts';

const TZ = 'America/Toronto';

async function post(fn: string, headers: Record<string, string>) {
  const res = await fetch(`${API_URL}/functions/v1/${fn}`, { method: 'POST', headers });
  return { status: res.status, json: await res.json() };
}

async function serverState(userId: string) {
  const sql = database();
  try {
    const [row] = await sql`
      select (select row_to_json(c) from public.characters c where c.user_id = ${userId}) as hero,
             (select count(*)::int from public.day_closures where user_id = ${userId}) as closures,
             (select count(*)::int from public.character_events where user_id = ${userId}) as events,
             (select count(*)::int from auth.users where id = ${userId})
           + (select count(*)::int from public.profiles where id = ${userId})
           + (select count(*)::int from public.habits where user_id = ${userId})
           + (select count(*)::int from public.completions where user_id = ${userId})
           + (select count(*)::int from public.inventory where user_id = ${userId}) as rows`;
    return row!;
  } finally {
    await sql.end();
  }
}

Deno.test({
  name: 'round trip: push, pull on a second phone, close the day twice, delete the account',
  ignore: NO_STACK,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await newUser();
    try {
      // Phone A: hero, two quests, a completion, and a purchase once there is gold.
      const [read, run] = [crypto.randomUUID(), crypto.randomUUID()];
      const today = localDate(Date.now(), TZ);
      const pushA = await callSync(
        user.token,
        request(0, [
          profileChange('Ada', TZ),
          habitChange(read, AT, { created_date: today }),
          habitChange(run, AT, { created_date: today, category: 'body', difficulty: 'hard' }),
          completionChange(crypto.randomUUID(), read, today, new Date().toISOString()),
        ]),
      );
      assertEquals(pushA.status, 200, JSON.stringify(pushA.json));
      assertEquals(syncResponseSchema.parse(pushA.json).rejected, []);
      await grant(user.id, { gold: 40 });
      const shield = gearChange(crypto.randomUUID(), 'oak-shield', new Date().toISOString(), true);
      const bought = syncResponseSchema.parse(
        (await callSync(user.token, request(0, [shield]))).json,
      );
      assertEquals(bought.applied, [shield.id]);

      // Phone B, signed in to the same account, starts from cursor 0 and gets it all.
      const pullB = syncResponseSchema.parse((await callSync(user.token, request(0))).json);
      const tables = pullB.changes.map((c) => c.table).sort();
      assertEquals(tables, ['completions', 'habits', 'habits', 'inventory', 'profiles']);
      assertEquals(pullB.character, bought.character);

      // The account started three days ago, so the nightly job has days to close.
      const sql = database();
      try {
        await sql`update public.profiles set created_at = now() - interval '3 days'
                  where id = ${user.id}`;
      } finally {
        await sql.end();
      }
      const secret = { 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' };
      assertEquals((await post('daily-tick', secret)).status, 200);
      const once = await serverState(user.id);
      assert(once.closures >= 2, `expected closed days, got ${once.closures}`);
      assertEquals((await post('daily-tick', secret)).status, 200);
      assertEquals(await serverState(user.id), once, 'the second run changed something');
      const hero = await replayed(user.id);
      assertEquals([hero.hp, hero.gold], [once.hero.hp, once.hero.gold]);

      // Deleting the account removes the user and every row.
      const deleted = await post('delete-account', { Authorization: `Bearer ${user.token}` });
      assertEquals(deleted.status, 200);
      const gone = await serverState(user.id);
      assertEquals([gone.rows, gone.closures, gone.events, gone.hero], [0, 0, 0, null]);
    } finally {
      await deleteUser(user);
    }
  },
});
