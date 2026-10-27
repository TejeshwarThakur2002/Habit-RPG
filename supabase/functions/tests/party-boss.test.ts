// Boss damage on sync and claiming the reward (SCOPE.md sections 9.2 and 9.4; D58), against
// the running stack: hits, retries, undo, victory, the current week only, no hits from an
// imported history, two members racing for the last hit, and the reward paid once.

import { assert, assertEquals } from '@std/assert';

import { localDate } from '../_shared/game-core/index.ts';
import { hitBoss } from '../_server/boss.ts';
import { partyStateSchema, syncResponseSchema } from '../_shared/shared/index.ts';
import {
  API_URL,
  NO_STACK,
  callSync,
  completionChange,
  database,
  deleteUser,
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
const now = () => new Date(Date.now() - 60_000).toISOString();

async function callParty(user: TestUser, body: unknown) {
  const res = await fetch(`${API_URL}/functions/v1/party`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function partyOf(user: TestUser) {
  const state = partyStateSchema.parse((await callParty(user, { action: 'state' })).json);
  assert(state.party !== null);
  return state.party;
}

async function sync(user: TestUser, changes: unknown[]) {
  const res = await callSync(user.token, request(0, changes));
  assertEquals(res.status, 200, JSON.stringify(res.json));
  return syncResponseSchema.parse(res.json);
}

async function query<T>(fn: (sql: ReturnType<typeof database>) => Promise<T>): Promise<T> {
  const sql = database();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** `count` players with a hero and a daily quest each, all in one party. */
async function withParty(
  count: number,
  fn: (users: TestUser[], quests: string[], bossId: string) => Promise<void>,
) {
  const users: TestUser[] = [];
  const quests: string[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const user = await newUser();
      users.push(user);
      const quest = crypto.randomUUID();
      quests.push(quest);
      await sync(user, [
        profileChange(`Hero${i + 1}`, TZ),
        habitChange(quest, now(), { name: 'Run' }),
      ]);
    }
    const made = await callParty(users[0]!, { action: 'create', name: 'Owls' });
    for (const user of users.slice(1))
      await callParty(user, { action: 'join', code: made.json.party.code });
    await fn(users, quests, made.json.party.boss.id);
  } finally {
    for (const user of users) await deleteUser(user);
  }
}

const done = (id: string, quest: string, undoneAt: string | null = null) =>
  completionChange(id, quest, today(), now(), undoneAt);
const setHp = (bossId: string, hp: number) =>
  query((sql) => sql`update public.boss_weeks set current_hp = ${hp} where id = ${bossId}`);

test('a completion hits the boss once, and undoing it gives the damage back', async () => {
  await withParty(1, async ([a], [quest]) => {
    const id = crypto.randomUUID();
    const res = await sync(a!, [done(id, quest!)]);
    const dealt = res.changes.find((c) => c.table === 'completions')!;
    const damage = (dealt as { data: { boss_damage: number } }).data.boss_damage;
    let party = await partyOf(a!);
    assertEquals(party.boss?.current_hp, 500 - damage);
    assertEquals(party.members[0]?.damage, damage);
    assertEquals([party.events[0]?.kind, party.events[0]?.habit_name], ['damage', 'Run']);

    await sync(a!, [done(id, quest!)]);
    assertEquals((await partyOf(a!)).boss?.current_hp, 500 - damage);

    await sync(a!, [done(id, quest!, now())]);
    party = await partyOf(a!);
    assertEquals(party.boss?.current_hp, 500);
    assertEquals(party.members[0]?.damage, 0);
    assertEquals(party.events[0]?.kind, 'undo');
  });
});

test('the last hit is cut to what is left, records the victory, and an undo keeps it', async () => {
  await withParty(1, async ([a], [quest], bossId) => {
    await setHp(bossId, 5);
    const id = crypto.randomUUID();
    await sync(a!, [done(id, quest!)]);
    let party = await partyOf(a!);
    assertEquals(party.boss?.current_hp, 0);
    assert(party.boss?.defeated_at !== null);
    assertEquals(
      party.events.slice(0, 2).map((e) => [e.kind, e.amount]),
      [
        ['victory', null],
        ['damage', 5],
      ],
    );
    await sync(a!, [done(id, quest!, now())]);
    party = await partyOf(a!);
    assertEquals([party.boss?.current_hp, party.boss?.defeated_at !== null], [0, true]);
  });
});

test('only completions dated in the boss week hit it, and an imported past never does', async () => {
  await withParty(1, async ([a], [quest], bossId) => {
    // The boss's week now starts tomorrow, so today's completion is outside it.
    await query(
      (sql) => sql`update public.boss_weeks set week_start = week_start + 7 where id = ${bossId}`,
    );
    await sync(a!, [done(crypto.randomUUID(), quest!)]);
    assertEquals((await partyOf(a!)).boss?.current_hp, 500);
  });
  await withParty(1, async ([a], _quests, _bossId) => {
    // "Keep this phone's hero" keeps the party (D56); the imported completion deals nothing.
    const quest = crypto.randomUUID();
    const res = await callSync(a!.token, {
      ...request(0, [
        profileChange('Kept', TZ),
        habitChange(quest, now(), { created_date: today() }),
        done(crypto.randomUUID(), quest),
      ]),
      import: { started_at: now(), done: true, replace: true },
    });
    assertEquals(res.status, 200, JSON.stringify(res.json));
    const party = await partyOf(a!);
    assertEquals([party.boss?.current_hp, party.members[0]?.hero_name], [500, 'Kept']);
  });
});

test('two members racing for the last hit: HP stops at 0, nothing lost, one victory', async () => {
  // The served function runs one transaction at a time, so the race is staged directly: the
  // first hit's transaction stays open while the second tries to hit the same boss.
  await withParty(2, async ([a, b], [qa, qb], bossId) => {
    await setHp(bossId, 15);
    const hit = (quest: string) => ({
      completionId: crypto.randomUUID(),
      localDate: today(),
      damage: 10,
      habitId: quest,
    });
    const first = database();
    const second = database();
    try {
      let release = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      let hitDone = () => {};
      const firstHit = new Promise<void>((resolve) => (hitDone = resolve));
      const one = first.begin(async (tx) => {
        await hitBoss(tx, a!.id, hit(qa!));
        hitDone();
        await held;
      });
      await firstHit;
      const two = second.begin((tx) => hitBoss(tx, b!.id, hit(qb!)));
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await Promise.all([one, two]);
    } finally {
      await first.end();
      await second.end();
    }
    const [boss] = await query(
      (sql) => sql`select current_hp from public.boss_weeks where id = ${bossId}`,
    );
    const events = await query(
      (sql) => sql`select kind, amount from public.party_events where boss_week_id = ${bossId}`,
    );
    const dealt = events.filter((e) => e.kind === 'damage').reduce((t, e) => t + e.amount, 0);
    assertEquals(boss!.current_hp, 0);
    assertEquals(dealt, 15);
    assertEquals(events.filter((e) => e.kind === 'victory').length, 1);
  });
});

test('the reward goes once to each member who saw the boss fall, through the event log', async () => {
  await withParty(2, async ([a, b], [qa], bossId) => {
    const claim = (user: TestUser) =>
      callParty(user, { action: 'claim_reward', boss_week_id: bossId });
    assertEquals((await claim(a!)).json.error, 'not_defeated');

    await setHp(bossId, 1);
    await sync(a!, [done(crypto.randomUUID(), qa!)]);
    const before = (await sync(b!, [])).character.gold;
    const paid = await claim(b!);
    assertEquals(paid.status, 200);
    assertEquals(paid.json.party.claimed, true);
    const after = await sync(b!, []);
    assertEquals(after.character.gold, before + 50);
    assertEquals((await replayed(b!.id)).gold, after.character.gold);
    assertEquals((await claim(b!)).json.error, 'already_claimed');
    assertEquals((await claim(a!)).status, 200);

    // Someone who joins after the victory can't claim it; a stranger can't see it.
    const late = await newUser();
    try {
      await sync(late, [profileChange('Late', TZ)]);
      const code = (await partyOf(a!)).code;
      await callParty(late, { action: 'join', code });
      assertEquals((await claim(late)).json.error, 'not_in_party');
    } finally {
      await deleteUser(late);
    }
  });
});
