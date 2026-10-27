// The first sync against the real `sync` function (D48 to D50, deferred from E1 to F; D53): a
// hero made on a phone is imported with its history, a second phone pulls it, and a third
// phone keeps its own hero, which the first phone then takes on through `hero_replaced`.

import { replayHero } from '@habit-rpg/game-core';

import { completeHabit } from '../../db/queries/completions';
import { createHabit } from '../../db/queries/habits';
import { getCharacter, getProfile } from '../../db/queries/hero';
import { createHero, recordSignIn } from '../../db/queries/local-data';
import { deleteAccount, newAccount, serverRows, type TestAccount } from '../../test/sync-stack';
import { PLAYER, newPhone, phoneRows, type TestPhone } from '../../test/test-phone';
import { closeHeroChoice, currentHeroChoice } from '../hero-choice';
import { currentNotice, dismissNotice } from '../notices';
import { HERO_REPLACED_NOTICE } from '../sync-service';

const DAY = 86_400_000;
const newId = () => crypto.randomUUID();

/** A hero made on the phone three days ago, with a quest done two days ago and today. */
async function localHero(account: TestAccount, name: string): Promise<TestPhone> {
  const phone = await newPhone(name, account);
  const start = Date.now() - 3 * DAY;
  createHero(phone.db, { heroName: name, heroClass: 'mage', timeZone: 'UTC', now: start });
  const quest = newId();
  createHabit(phone.db, {
    userId: PLAYER,
    id: quest,
    now: start,
    fields: {
      name: 'Read',
      type: 'daily',
      difficulty: 'easy',
      category: 'mind',
      weekdays: 127,
      reminderTime: null,
    },
  });
  for (const at of [Date.now() - 2 * DAY, Date.now()]) {
    completeHabit(phone.db, { userId: PLAYER, habitId: quest, now: at, newId });
  }
  return phone;
}

async function serverHero(account: TestAccount) {
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
  return hero!;
}

let account: TestAccount;
beforeEach(async () => {
  account = await newAccount();
});
afterEach(async () => {
  closeHeroChoice();
  while (currentNotice() !== null) dismissNotice();
  await deleteAccount(account);
});

it("imports a phone's hero with its history, and a second phone pulls the same hero", async () => {
  const a = await localHero(account, 'Ada');
  recordSignIn(a.db, { id: account.id, email: 'ada@example.com' });
  await a.sync();
  expect(a.waiting()).toBe(0);

  // Replayed by the server's rules: a missed day cost HP, both completions earned XP.
  const hero = await serverHero(account);
  expect(hero.hp).toBeLessThan(44);
  expect(getCharacter(a.db, PLAYER)).toMatchObject({ hp: hero.hp, gold: hero.gold });

  const b = await newPhone('B', account);
  recordSignIn(b.db, { id: account.id, email: 'ada@example.com' });
  await b.sync();
  expect(getProfile(b.db, PLAYER)?.heroName).toBe('Ada');
  expect(phoneRows(b)).toEqual(phoneRows(a));
  expect(getCharacter(b.db, PLAYER)).toMatchObject({ hp: hero.hp, gold: hero.gold });
});

it("keeps a third phone's hero over the account's, and the first phone takes it on", async () => {
  const a = await localHero(account, 'Ada');
  recordSignIn(a.db, { id: account.id, email: 'ada@example.com' });
  await a.sync();

  const c = await localHero(account, 'Cleo');
  recordSignIn(c.db, { id: account.id, email: 'ada@example.com' });
  await c.sync();
  expect(currentHeroChoice()?.accountHero).toMatchObject({ hero_name: 'Ada', class: 'mage' });
  await c.service.firstSync(account.id, { replace: true });
  expect((await serverRows<{ hero_name: string }>('profiles', account, 'hero_name'))[0]).toEqual({
    hero_name: 'Cleo',
  });

  // Ada's phone syncs as usual, is told its hero was replaced, and takes Cleo on.
  await a.sync();
  expect(getProfile(a.db, PLAYER)?.heroName).toBe('Cleo');
  expect(phoneRows(a)).toEqual(phoneRows(c));
  expect(currentNotice()).toBe(HERO_REPLACED_NOTICE);
  await serverHero(account);
});
