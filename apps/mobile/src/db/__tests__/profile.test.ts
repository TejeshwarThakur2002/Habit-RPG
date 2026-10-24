import { eq } from 'drizzle-orm';

import { getProfile, updateProfile } from '../queries/hero';
import { partyMembers } from '../schema';
import { seedDemo } from '../seed-demo';
import { LOCAL_USER_ID, type AppDb } from '../types';
import { counterIds, createTestDb } from '../../test/test-db';

const NOW = Date.parse('2026-10-20T22:00:00Z');
const TZ = 'America/Toronto';

let db: AppDb;
beforeEach(async () => {
  db = await createTestDb();
  seedDemo(db, { now: NOW, timeZone: TZ, newId: counterIds() });
});

function memberName(userId: string) {
  return db
    .select({ heroName: partyMembers.heroName })
    .from(partyMembers)
    .where(eq(partyMembers.userId, userId))
    .get()?.heroName;
}

describe('updateProfile', () => {
  it('renames the hero everywhere the name is stored', () => {
    updateProfile(db, LOCAL_USER_ID, { heroName: 'Lady Merge' }, NOW);

    expect(getProfile(db, LOCAL_USER_ID)?.heroName).toBe('Lady Merge');
    expect(memberName(LOCAL_USER_ID)).toBe('Lady Merge');
    expect(memberName('demo-ravi')).toBe('Mage Ravi');
  });

  it('changes the time zone without touching the name', () => {
    updateProfile(db, LOCAL_USER_ID, { timezone: 'Pacific/Auckland' }, NOW);

    expect(getProfile(db, LOCAL_USER_ID)).toMatchObject({
      heroName: 'Sir Commit',
      timezone: 'Pacific/Auckland',
    });
    expect(memberName(LOCAL_USER_ID)).toBe('Sir Commit');
  });
});
