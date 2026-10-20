import { counterIds, createTestDb } from '../../test/test-db';
import { getCharacter, getProfile, listActiveHabits } from '../queries/hero';
import { createHero, resetLocalData } from '../queries/local-data';
import { getSettings, updateSettings } from '../queries/settings';
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
