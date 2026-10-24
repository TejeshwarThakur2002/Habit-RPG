// Pushing gear through `sync`: purchases checked against the server's gold, undoing one,
// equipping as last write wins, HP fitting the new max HP, and the event log (D39).

import { assert, assertEquals } from '@std/assert';

import { gearItem, heroStats, newHero, type GearId } from '../_shared/game-core/index.ts';
import { syncResponseSchema, type ServerChange } from '../_shared/shared/index.ts';
import {
  NO_STACK,
  callSync,
  database,
  deleteUser,
  gearChange,
  newUser,
  profileChange,
  replayed,
  request,
  undoPurchase,
  type TestUser,
} from './helpers.ts';

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, fn, ignore: NO_STACK, sanitizeOps: false, sanitizeResources: false });

/** The phone's clock, `minute` minutes into a fixed morning. */
const t = (minute: number) => new Date(Date.UTC(2026, 9, 24, 10, minute)).toISOString();
const uuid = () => crypto.randomUUID();
const maxHpWith = (equipped: GearId[]) =>
  heroStats({ completionsByCategory: {}, longestStreakDays: 0, equipped }).maxHp;
const price = (id: GearId) => gearItem(id).price;

/** A player with a profile, so a brand-new hero with no gold. */
async function withPlayer(fn: (p: TestUser) => Promise<void>) {
  const user = await newUser();
  try {
    await push(user, [profileChange('Ada')]);
    await fn(user);
  } finally {
    await deleteUser(user);
  }
}

async function push(user: TestUser, changes: unknown[], cursor = 0) {
  const res = await callSync(user.token, request(cursor, changes));
  assertEquals(res.status, 200, JSON.stringify(res.json));
  return syncResponseSchema.parse(res.json);
}

/** Gives the hero gold or HP through an event, as the server would, so replays stay exact. */
async function grant(userId: string, { gold = 0, hp = 0 }) {
  const sql = database();
  try {
    await sql`
      insert into public.character_events (user_id, kind, ref_id, xp_delta, gold_delta, hp_delta)
      values (${userId}, 'test-grant', ${uuid()}, 0, ${gold}, ${hp})`;
    await sql`update public.characters set gold = gold + ${gold}, hp = hp + ${hp}
              where user_id = ${userId}`;
  } finally {
    await sql.end();
  }
}

/** The last pulled change to an inventory row, failing the test if there is none. */
function itemIn(changes: ServerChange[], id: string) {
  const change = changes
    .filter((c) => c.table === 'inventory')
    .findLast((c) => (c.op === 'delete' ? c.id : (c.data as { id: string }).id) === id);
  assert(change?.table === 'inventory', `inventory ${id} was not pulled`);
  return change;
}

const worn = (change: ReturnType<typeof itemIn>) =>
  change.op === 'upsert' ? change.data.equipped : 'undone';

test("a purchase takes the price from the server's gold, once", async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 100 });
    const shield = gearChange(uuid(), 'oak-shield', t(1));
    const res = await push(p, [shield]);
    assertEquals(res.applied, [shield.id]);
    assertEquals(res.character.gold, 100 - price('oak-shield'));
    assertEquals(worn(itemIn(res.changes, shield.id)), false);

    const again = await push(p, [shield]);
    assertEquals(again.applied, [shield.id]);
    assertEquals(again.character.gold, 100 - price('oak-shield'));
  });
});

test("purchases the server can't afford, hasn't unlocked or already has are refused", async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 50 });
    const shield = gearChange(uuid(), 'oak-shield', t(1));
    const res = await push(p, [
      shield,
      gearChange(uuid(), 'oak-shield', t(2)), // bought on another phone too
      gearChange(uuid(), 'wizard-hat', t(3)), // 75 gold, 10 left
      gearChange(uuid(), 'dragon-cape', t(4)), // unlocks at level 10
    ]);
    assertEquals(res.applied, [shield.id]);
    assertEquals(
      res.rejected.map((r) => r.reason),
      ['duplicate', 'insufficient_gold', 'invalid'],
    );
    assertEquals(res.character.gold, 50 - price('oak-shield'));
  });
});

test('gear sent before any profile is refused', async () => {
  const user = await newUser();
  try {
    const shield = gearChange(uuid(), 'oak-shield', t(1));
    const res = await push(user, [shield]);
    assertEquals(res.rejected, [{ id: shield.id, table: 'inventory', reason: 'invalid' }]);
  } finally {
    await deleteUser(user);
  }
});

test('undoing a purchase refunds it once, and the item can be bought again', async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 100 });
    const shield = gearChange(uuid(), 'oak-shield', t(1));
    await push(p, [shield]);
    const undone = await push(p, [undoPurchase(shield.id, t(2))]);
    assertEquals(undone.applied, [shield.id]);
    assertEquals(undone.character.gold, 100);
    assertEquals(itemIn(undone.changes, shield.id), {
      table: 'inventory',
      op: 'delete',
      id: shield.id,
    });

    // Sending the undo or the old purchase again changes nothing: the undo wins.
    const retried = await push(p, [undoPurchase(shield.id, t(2)), shield], undone.cursor);
    assertEquals(retried.applied, [shield.id, shield.id]);
    assertEquals(retried.character.gold, 100);
    assertEquals(worn(itemIn(retried.changes, shield.id)), 'undone');

    const rebought = gearChange(uuid(), 'oak-shield', t(3));
    const res = await push(p, [rebought]);
    assertEquals(res.applied, [rebought.id]);
    assertEquals(res.character.gold, 100 - price('oak-shield'));
  });
});

test('equipping is last write wins', async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 100 });
    const id = uuid();
    await push(p, [gearChange(id, 'oak-shield', t(1))]);
    const on = await push(p, [gearChange(id, 'oak-shield', t(3), true)]);
    assertEquals(worn(itemIn(on.changes, id)), true);

    // Taken off earlier on a phone that synced later: the newer equip stays, and the row
    // comes back on the same sync so that phone puts it on again.
    const older = await push(p, [gearChange(id, 'oak-shield', t(2), false)], on.cursor);
    assertEquals(older.applied, [id]);
    assertEquals(worn(itemIn(older.changes, id)), true);

    const newer = await push(p, [gearChange(id, 'oak-shield', t(4), false)]);
    assertEquals(worn(itemIn(newer.changes, id)), false);
  });
});

test('taking gear off lowers HP to the new max HP', async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 100 });
    const id = uuid();
    const bare = maxHpWith([]);
    const shielded = maxHpWith(['oak-shield']);
    assert(shielded > bare);

    // Bought and put on before syncing: one change carries both.
    await push(p, [gearChange(id, 'oak-shield', t(1), true)]);
    await grant(p.id, { hp: shielded - newHero().hp });
    const off = await push(p, [gearChange(id, 'oak-shield', t(2), false)]);
    assertEquals(off.character.hp, bare);

    // Undoing the purchase of worn gear does the same, and refunds it.
    await push(p, [gearChange(id, 'oak-shield', t(3), true)]);
    await grant(p.id, { hp: shielded - bare });
    const undone = await push(p, [undoPurchase(id, t(4))]);
    assertEquals([undone.character.hp, undone.character.gold], [bare, 100]);
  });
});

test("another player's gear can't be changed or undone", async () => {
  await withPlayer(async (a) => {
    await grant(a.id, { gold: 100 });
    const id = uuid();
    await push(a, [gearChange(id, 'oak-shield', t(1))]);
    await withPlayer(async (b) => {
      const res = await push(b, [gearChange(id, 'oak-shield', t(2), true), undoPurchase(id, t(3))]);
      assertEquals(
        res.rejected.map((r) => r.reason),
        ['invalid', 'invalid'],
      );
    });
    const mine = await push(a, []);
    assertEquals(worn(itemIn(mine.changes, id)), false);
    assertEquals(mine.character.gold, 100 - price('oak-shield'));
  });
});

test('the event log replays to the stored hero after purchases, equips and refunds', async () => {
  await withPlayer(async (p) => {
    await grant(p.id, { gold: 300 });
    const shield = uuid();
    const hat = uuid();
    await push(p, [
      gearChange(shield, 'oak-shield', t(1), true),
      gearChange(hat, 'wizard-hat', t(2)),
    ]);
    await grant(p.id, { hp: 2 });
    await push(p, [gearChange(shield, 'oak-shield', t(3), false), undoPurchase(hat, t(4))]);
    await push(p, [gearChange(shield, 'oak-shield', t(5), true)]);
    await grant(p.id, { hp: 2 });
    const res = await push(p, [undoPurchase(shield, t(6)), gearChange(uuid(), 'iron-sword', t(7))]);

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
    assertEquals(
      [res.character.gold, res.character.hp],
      [300 - price('iron-sword'), maxHpWith([])],
    );
  });
});
