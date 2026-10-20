// Demo mode (SCOPE.md F11): a pre-filled, local-only hero so a reviewer can try the app in
// seconds. The data matches the design canvas: Sir Commit, level 7, a 12-day streak and a
// party fighting the Procrastination Slime.

import {
  addDays,
  baseValues,
  bossMaxHp,
  localDate,
  weekStart,
  type Category,
  type Difficulty,
  type HabitType,
} from '@habit-rpg/game-core';

import { deletePlayerData } from './queries/local-data';
import * as t from './schema';
import { LOCAL_USER_ID, type AppDb } from './types';

export interface SeedOptions {
  now: number;
  timeZone: string;
  /** UUID source: expo-crypto in the app, a counter in tests. */
  newId: () => string;
}

const HISTORY_DAYS = 84;

const HABITS: { name: string; type: HabitType; difficulty: Difficulty; category: Category }[] = [
  { name: 'Drink 8 glasses of water', type: 'daily', difficulty: 'easy', category: 'health' },
  { name: 'Code for 1 hour', type: 'daily', difficulty: 'medium', category: 'mind' },
  { name: '30 min workout', type: 'daily', difficulty: 'hard', category: 'body' },
  { name: 'Read 20 pages', type: 'daily', difficulty: 'medium', category: 'mind' },
  { name: 'No doomscrolling after 11pm', type: 'bad', difficulty: 'easy', category: 'none' },
];

/** Deterministic history: water every recent day (the streak), the rest on a pattern. */
function doneOn(habitIndex: number, daysAgo: number): boolean {
  if (daysAgo === 0) return habitIndex < 2;
  if (habitIndex === 0) return daysAgo <= 16 || (daysAgo * 3) % 4 !== 0;
  return (daysAgo * 7 + habitIndex * 3) % 5 > 1 || (daysAgo < 30 && habitIndex === 1);
}

/** Replaces all local data with the demo hero. Runs in one transaction. */
export function seedDemo(db: AppDb, { now, timeZone, newId }: SeedOptions): void {
  const today = localDate(now, timeZone);
  const stamp = new Date(now).toISOString();
  const userId = LOCAL_USER_ID;

  db.transaction((tx) => {
    deletePlayerData(tx);

    tx.insert(t.profiles)
      .values({
        id: userId,
        heroName: 'Sir Commit',
        heroClass: 'knight',
        timezone: timeZone,
        createdAt: stamp,
      })
      .run();
    tx.insert(t.characters)
      .values({
        userId,
        level: 7,
        xpInLevel: 340,
        hp: 42,
        gold: 128,
        currentStreak: 12,
        longestStreak: 16,
        lastClosedDate: addDays(today, -1),
      })
      .run();

    const createdDate = addDays(today, -HISTORY_DAYS);
    const habitIds = HABITS.map((habit, i) => {
      const id = newId();
      tx.insert(t.habits)
        .values({ id, userId, ...habit, sortOrder: i, createdDate, clientUpdatedAt: stamp })
        .run();
      return id;
    });

    for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
      const date = addDays(today, -daysAgo);
      HABITS.forEach((habit, i) => {
        if (!doneOn(i, daysAgo)) return;
        const base = baseValues(habit.type, habit.difficulty);
        tx.insert(t.completions)
          .values({
            id: newId(),
            userId,
            habitId: habitIds[i] as string,
            localDate: date,
            completedAt: `${date}T20:00:00.000Z`,
            category: habit.category,
            xpAwarded: base.xp,
            goldAwarded: base.gold,
            bossDamage: base.xp,
          })
          .run();
      });
    }

    tx.insert(t.inventory)
      .values([
        { id: newId(), userId, itemId: 'iron-sword', equipped: true, purchasedAt: stamp },
        { id: newId(), userId, itemId: 'leather-boots', equipped: false, purchasedAt: stamp },
      ])
      .run();

    seedDemoParty(tx, { now, timeZone, newId, stamp, userId });
    const demoFlags = { demoMode: true, localOnly: false, onboardingDone: true };
    tx.insert(t.settings)
      .values({ id: 1, ...demoFlags })
      .onConflictDoUpdate({ target: t.settings.id, set: demoFlags })
      .run();
  });
}

function seedDemoParty(
  tx: Pick<AppDb, 'insert'>,
  o: SeedOptions & { stamp: string; userId: string },
): void {
  const partyId = o.newId();
  const bossWeekId = o.newId();
  const members = [
    { userId: o.userId, heroName: 'Sir Commit', heroClass: 'knight' as const },
    { userId: 'demo-ravi', heroName: 'Mage Ravi', heroClass: 'mage' as const },
    { userId: 'demo-nia', heroName: 'Archer Nia', heroClass: 'rogue' as const },
    { userId: 'demo-jay', heroName: 'Bard Jay', heroClass: 'mage' as const },
  ];

  tx.insert(t.parties)
    .values({ id: partyId, name: 'The Night Owls', code: 'K7M2QX', timezone: o.timeZone })
    .run();
  tx.insert(t.partyMembers)
    .values(members.map((m) => ({ ...m, partyId, joinedAt: o.stamp })))
    .run();
  tx.insert(t.bossWeeks)
    .values({
      id: bossWeekId,
      partyId,
      weekStart: weekStart(o.now, o.timeZone),
      bossKey: 'procrastination-slime',
      maxHp: bossMaxHp(members.length),
      currentHp: 1240,
    })
    .run();

  const events = [
    {
      userId: 'demo-ravi',
      kind: 'damage' as const,
      amount: 20,
      habitName: 'Read 20 pages',
      minutesAgo: 2,
    },
    {
      userId: o.userId,
      kind: 'damage' as const,
      amount: 20,
      habitName: 'Code for 1 hour',
      minutesAgo: 60,
    },
    {
      userId: 'demo-jay',
      kind: 'boss_attack' as const,
      amount: 8,
      habitName: '30 min workout',
      minutesAgo: 600,
    },
  ];
  tx.insert(t.partyEvents)
    .values(
      events.map(({ minutesAgo, ...e }) => ({
        ...e,
        id: o.newId(),
        partyId,
        bossWeekId,
        createdAt: new Date(o.now - minutesAgo * 60_000).toISOString(),
      })),
    )
    .run();
}
