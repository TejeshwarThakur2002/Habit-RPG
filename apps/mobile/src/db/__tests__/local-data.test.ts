import { counterIds, createTestDb } from '../../test/test-db';
import { createHabit } from '../queries/habits';
import { getCharacter, getProfile, listActiveHabits } from '../queries/hero';
import { createHero, recordSignIn, resetLocalData } from '../queries/local-data';
import { getSettings, updateSettings } from '../queries/settings';
import { characters } from '../schema';
import { seedDemo } from '../seed-demo';
import { LOCAL_USER_ID, type AppDb } from '../types';

const NOW = Date.parse('2026-10-20T22:00:00Z');
const TZ = 'America/Toronto';

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
});

describe('createHero', () => {
  it('creates a level 1 hero with 44 HP and no gold, and finishes onboarding', () => {
    updateSettings(db, { localOnly: true });
    createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW });

    expect(getProfile(db, LOCAL_USER_ID)).toMatchObject({
      heroName: 'Ada',
      heroClass: 'mage',
      timezone: TZ,
    });
    expect(getCharacter(db, LOCAL_USER_ID)).toMatchObject({
      level: 1,
      xpInLevel: 0,
      hp: 44,
      gold: 0,
    });
    expect(getSettings(db)).toMatchObject({
      localOnly: true,
      onboardingDone: true,
      demoMode: false,
    });
  });

  it('replaces leftover demo data', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() });
    createHero(db, { heroName: 'Ada', heroClass: 'rogue', timeZone: TZ, now: NOW });

    expect(listActiveHabits(db, LOCAL_USER_ID)).toHaveLength(0);
    expect(getCharacter(db, LOCAL_USER_ID)?.gold).toBe(0);
    expect(getSettings(db).demoMode).toBe(false);
  });
});

describe('resetLocalData', () => {
  it('wipes the player and returns to sign-in', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() });
    resetLocalData(db);

    expect(getProfile(db, LOCAL_USER_ID)).toBeUndefined();
    expect(listActiveHabits(db, LOCAL_USER_ID)).toHaveLength(0);
    expect(getSettings(db)).toMatchObject({
      demoMode: false,
      localOnly: false,
      onboardingDone: false,
    });
  });
});

describe('recordSignIn', () => {
  it('stores the account so the route guard sees a session, and sign-out forgets it', () => {
    seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() });
    recordSignIn(db, { id: 'user-1', email: 'ada@example.com' });
    expect(getSettings(db)).toMatchObject({
      accountUserId: 'user-1',
      accountEmail: 'ada@example.com',
      demoMode: false,
    });

    resetLocalData(db);
    expect(getSettings(db)).toMatchObject({ accountUserId: null, accountEmail: null });
  });
});

describe('linking a local hero to an account (D34)', () => {
  it('keeps the hero, quests and gold, and stops counting as local-only', () => {
    updateSettings(db, { localOnly: true });
    createHero(db, { heroName: 'Ada', heroClass: 'mage', timeZone: TZ, now: NOW });
    createHabit(db, {
      userId: LOCAL_USER_ID,
      id: 'h1',
      now: NOW,
      fields: {
        name: 'Read',
        type: 'daily',
        difficulty: 'easy',
        category: 'mind',
        weekdays: 127,
        reminderTime: null,
      },
    });
    db.update(characters).set({ gold: 42 }).run();
    const before = {
      profile: getProfile(db, LOCAL_USER_ID),
      habits: listActiveHabits(db, LOCAL_USER_ID),
    };

    recordSignIn(db, { id: 'user-1', email: 'ada@example.com' });

    expect(getProfile(db, LOCAL_USER_ID)).toEqual(before.profile);
    expect(listActiveHabits(db, LOCAL_USER_ID)).toEqual(before.habits);
    expect(getCharacter(db, LOCAL_USER_ID)?.gold).toBe(42);
    expect(getSettings(db)).toMatchObject({
      localOnly: false,
      onboardingDone: true,
      accountUserId: 'user-1',
    });
  });
});
