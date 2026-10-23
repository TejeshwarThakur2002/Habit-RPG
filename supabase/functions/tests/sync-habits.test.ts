// Pushing habits through `sync`: SCOPE.md section 8.3's conflict rules, on the local stack.

import { assert, assertEquals } from '@std/assert';

import { syncResponseSchema, type ServerChange } from '../_shared/shared/index.ts';
import {
  NO_STACK,
  callSync,
  deleteUser,
  habitChange,
  newUser,
  profileChange,
  request,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

const T1 = '2026-10-23T10:00:00Z';
const T2 = '2026-10-23T11:00:00Z';
const T3 = '2026-10-23T12:00:00Z';

/** A signed-in player with a profile on the server, deleted afterwards. */
async function withPlayer(fn: (user: TestUser) => Promise<void>) {
  const user = await newUser();
  try {
    await callSync(user.token, request(0, [profileChange('Ada')]));
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

async function push(user: TestUser, changes: unknown[], cursor = 0) {
  const res = await callSync(user.token, request(cursor, changes));
  assertEquals(res.status, 200);
  return syncResponseSchema.parse(res.json);
}

/** The latest pulled version of a habit, as the phone would apply it. */
function habitIn(changes: ServerChange[], id: string) {
  const rows = changes.filter((c) => c.table === 'habits' && c.op === 'upsert');
  const row = rows.map((c) => c.data as { id: string }).findLast((d) => d.id === id);
  assert(row, `habit ${id} was not pulled`);
  return row as unknown as { name: string; deleted_at: string | null; client_updated_at: string };
}

test('a new habit is stored and reaches the phone with its server_seq', async () => {
  await withPlayer(async (user) => {
    const id = crypto.randomUUID();
    const res = await push(user, [habitChange(id, T1, { name: ' Read​ 20 pages ' })]);
    assertEquals(res.applied, [id]);
    assertEquals(res.rejected, []);
    assertEquals(habitIn(res.changes, id).name, 'Read 20 pages');
  });
});

test('the newer edit wins, and a phone sending an older one gets the newer back', async () => {
  await withPlayer(async (user) => {
    const id = crypto.randomUUID();
    const first = await push(user, [habitChange(id, T2, { name: 'Newer' })]);
    // Another phone, offline since earlier, sends an edit made at T1.
    const stale = await push(user, [habitChange(id, T1, { name: 'Older' })], first.cursor);
    assertEquals(stale.applied, [id]);
    assertEquals(habitIn(stale.changes, id).name, 'Newer');
  });
});

test('with equal edit times the later arrival wins', async () => {
  await withPlayer(async (user) => {
    const id = crypto.randomUUID();
    await push(user, [habitChange(id, T2, { name: 'First' })]);
    const second = await push(user, [habitChange(id, T2, { name: 'Second' })]);
    assertEquals(habitIn(second.changes, id).name, 'Second');
  });
});

test('a delete beats every later edit and keeps its first time', async () => {
  await withPlayer(async (user) => {
    const id = crypto.randomUUID();
    await push(user, [habitChange(id, T1)]);
    await push(user, [habitChange(id, T2, { deleted_at: T2 })]);
    const edited = await push(user, [habitChange(id, T3, { name: 'Revived?' })]);
    const row = habitIn(edited.changes, id);
    assertEquals(row.deleted_at, '2026-10-23T11:00:00.000Z');
    assertEquals(row.name, 'Read');
    const deletedAgain = await push(user, [habitChange(id, T3, { deleted_at: T3 })]);
    assertEquals(habitIn(deletedAgain.changes, id).deleted_at, '2026-10-23T11:00:00.000Z');
  });
});

test("another player's habit id is refused, not overwritten", async () => {
  await withPlayer(async (a) => {
    await withPlayer(async (b) => {
      const id = crypto.randomUUID();
      await push(a, [habitChange(id, T1, { name: "A's" })]);
      const res = await push(b, [habitChange(id, T3, { name: "B's" })]);
      assertEquals(res.rejected, [{ id, table: 'habits', reason: 'invalid' }]);
      const mine = await push(a, []);
      assertEquals(habitIn(mine.changes, id).name, "A's");
    });
  });
});

test('a habit sent before any profile is refused', async () => {
  const user = await newUser();
  try {
    const id = crypto.randomUUID();
    const res = await push(user, [habitChange(id, T1)]);
    assertEquals(res.rejected, [{ id, table: 'habits', reason: 'invalid' }]);
  } finally {
    await deleteUser(user);
  }
});
