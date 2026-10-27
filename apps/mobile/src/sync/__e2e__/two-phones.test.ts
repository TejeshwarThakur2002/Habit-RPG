// The two-phone test (SCOPE.md P4 done criterion, D45, D53): two phones signed in to one account
// make changes online and offline, in a random order, against the real `sync` function. After
// they reconnect and sync, no completion may be lost or duplicated, both phones must hold what
// the server holds, and the server's event log must add up to its hero.

import { localDate, replayHero } from '@habit-rpg/game-core';

import { completeHabit, undoCompletion } from '../../db/queries/completions';
import { createHabit, getHabit, updateHabit } from '../../db/queries/habits';
import { getCharacter } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { habits } from '../../db/schema';
import { deleteAccount, newAccount, serverRows, type TestAccount } from '../../test/sync-stack';
import { PLAYER, newPhone, phoneRows, seeded, type TestPhone } from '../../test/test-phone';

const RUNS = Number(process.env.RUNS ?? 50);
const STEPS = 20;
// A fresh base seed each time explores new orderings; SEED=<n> replays one run.
const BASE = Number(process.env.SEED ?? Date.now() % 1_000_000);
const newId = () => crypto.randomUUID();
const FIELDS = {
  type: 'daily',
  difficulty: 'easy',
  category: 'mind',
  weekdays: 127,
  reminderTime: null,
} as const;

/** Phone A makes the hero and two quests; phone B signs in and pulls them. */
async function setUp(account: TestAccount): Promise<[TestPhone, TestPhone]> {
  const a = await newPhone('A', account);
  const b = await newPhone('B', account);
  recordSignIn(a.db, { id: account.id, email: 'a@example.com' });
  createHero(a.db, { heroName: 'Twin', heroClass: 'knight', timeZone: 'UTC', now: Date.now() });
  for (const name of ['Read', 'Run']) {
    createHabit(a.db, {
      userId: PLAYER,
      id: newId(),
      now: Date.now(),
      fields: { name, ...FIELDS },
    });
  }
  await a.sync();
  await a.sync();
  recordSignIn(b.db, { id: account.id, email: 'b@example.com' });
  await b.sync();
  return [a, b];
}

const questIds = (phone: TestPhone) =>
  phone.db
    .select({ id: habits.id })
    .from(habits)
    .all()
    .map((h) => h.id);

/** One random step; returns a line for the failure report. */
/** Every completion made on a phone: the quest and day it was for, and when. */
type Made = Map<string, { key: string; at: number }>;

async function step(rand: ReturnType<typeof seeded>, phones: TestPhone[], made: Made) {
  const phone = rand.pick(phones);
  const quest = rand.pick(questIds(phone));
  const now = Date.now();
  switch (rand.pick(['complete', 'complete', 'undo', 'add', 'rename', 'net', 'lose', 'sync'])) {
    case 'complete': {
      const done = completeHabit(phone.db, { userId: PLAYER, habitId: quest, now, newId });
      if (done) made.set(done.completionId, { key: `${quest}|${localDate(now, 'UTC')}`, at: now });
      return `${phone.name} completes ${quest.slice(0, 4)}`;
    }
    case 'undo':
      undoCompletion(phone.db, PLAYER, quest, now);
      return `${phone.name} undoes ${quest.slice(0, 4)}`;
    case 'add':
      createHabit(phone.db, {
        userId: PLAYER,
        id: newId(),
        now,
        fields: { name: 'New', ...FIELDS },
      });
      return `${phone.name} adds a quest`;
    case 'rename': {
      const habit = getHabit(phone.db, PLAYER, quest);
      if (habit)
        updateHabit(phone.db, PLAYER, quest, now, { ...FIELDS, name: `${phone.name}${now}` });
      return `${phone.name} renames ${quest.slice(0, 4)}`;
    }
    case 'net':
      phone.online = !phone.online;
      return `${phone.name} goes ${phone.online ? 'online' : 'offline'}`;
    case 'lose':
      phone.loseNextReply = true;
      return `${phone.name} will lose its next reply`;
    default:
      await phone.sync();
      return `${phone.name} syncs`;
  }
}

/** Everyone back online, syncing in turn until both have sent and pulled everything. */
async function settle(phones: TestPhone[]) {
  for (const phone of phones) {
    phone.online = true;
    phone.loseNextReply = false;
  }
  for (let round = 0; round < 3; round++) for (const phone of phones) await phone.sync();
}

type ServerCompletion = {
  id: string;
  habit_id: string;
  local_date: string;
  completed_at: string;
  undone_at: string | null;
};

async function check(account: TestAccount, phones: TestPhone[], made: Made) {
  const done = await serverRows<ServerCompletion>(
    'completions',
    account,
    'id,habit_id,local_date,completed_at,undone_at',
  );
  const quests = await serverRows<{ id: string; name: string }>('habits', account, 'id,name');

  // No duplicates: one active completion per quest and day.
  const active = done
    .filter((c) => c.undone_at === null)
    .map((c) => `${c.habit_id}|${c.local_date}`);
  expect(active.length).toBe(new Set(active).size);

  // Nothing lost: every completion made is on the server, or was refused because the server
  // already had an earlier one for that quest and day (SCOPE.md section 8: the earliest wins).
  // That earlier one may have been undone since, from a phone that was offline (D53).
  const onServer = new Set(done.map((c) => c.id));
  for (const [id, { key, at }] of made) {
    if (onServer.has(id)) continue;
    const earlier = done.some(
      (c) => `${c.habit_id}|${c.local_date}` === key && Date.parse(c.completed_at) <= at,
    );
    expect({ id, earlier }).toEqual({ id, earlier: true });
    for (const phone of phones) expect(phoneRows(phone).done.map((c) => c.id)).not.toContain(id);
  }

  // Agreement: both phones hold exactly the server's quests and completions.
  const server = {
    quests: quests
      .map((q) => ({ id: q.id, name: q.name }))
      .sort((x, y) => x.id.localeCompare(y.id)),
    done: done
      .map((c) => ({ id: c.id, undone: c.undone_at !== null }))
      .sort((x, y) => x.id.localeCompare(y.id)),
  };
  for (const phone of phones) expect(phoneRows(phone)).toEqual(server);

  // The hero: the event log adds up to the stored hero, which both phones show.
  const [hero] = await serverRows<{ level: number; xp_in_level: number; hp: number; gold: number }>(
    'characters',
    account,
    'level,xp_in_level,hp,gold',
  );
  const events = await serverRows<{ xp_delta: number; gold_delta: number; hp_delta: number }>(
    'character_events',
    account,
    'xp_delta,gold_delta,hp_delta',
  );
  const replayed = replayHero(
    events.map((e) => ({ xp: e.xp_delta, gold: e.gold_delta, hp: e.hp_delta })),
  );
  expect([replayed.level, replayed.xpInLevel, replayed.hp, replayed.gold]).toEqual([
    hero!.level,
    hero!.xp_in_level,
    hero!.hp,
    hero!.gold,
  ]);
  for (const phone of phones) {
    expect(getCharacter(phone.db, PLAYER)).toMatchObject({ level: hero!.level, gold: hero!.gold });
  }
}

describe('two phones, one account', () => {
  it.each(Array.from({ length: RUNS }, (_, i) => BASE + i))(
    'loses and duplicates nothing (seed %i)',
    async (seed) => {
      const account = await newAccount();
      const log: string[] = [];
      try {
        const phones = await setUp(account);
        const rand = seeded(seed);
        const made: Made = new Map();
        for (let i = 0; i < STEPS; i++) log.push(await step(rand, phones, made));
        await settle(phones);
        await check(account, phones, made);
      } catch (error) {
        throw new Error(`Seed ${seed} failed after: ${log.join('; ')}`, { cause: error });
      } finally {
        await deleteAccount(account);
      }
    },
  );
});
