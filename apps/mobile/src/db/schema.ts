// On-device SQLite schema (SCOPE.md section 8.2). It mirrors the Postgres tables in section 8.1:
// UUIDs and ISO dates are text, booleans are 0/1 integers, column names are snake_case.
// Every change here needs `pnpm --filter @habit-rpg/mobile db:generate` and a new migration.

import type {
  BossKey,
  Category,
  Difficulty,
  GearId,
  HabitType,
  HeroClass,
} from '@habit-rpg/game-core';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type { FaintNotice } from './types';

const bool = (name: string) => integer(name, { mode: 'boolean' });

/** Synced rows also carry the server's sequence number (section 8.3, pull cursor). */
const serverSeq = () => integer('server_seq');

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  heroName: text('hero_name').notNull(),
  heroClass: text('class').$type<HeroClass>().notNull(),
  timezone: text('timezone').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Server-owned; the app keeps an optimistic local estimate (section 8.3). */
export const characters = sqliteTable('characters', {
  userId: text('user_id').primaryKey(),
  level: integer('level').notNull().default(1),
  xpInLevel: integer('xp_in_level').notNull().default(0),
  hp: integer('hp').notNull().default(44),
  gold: integer('gold').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastClosedDate: text('last_closed_date'),
});

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type').$type<HabitType>().notNull(),
    difficulty: text('difficulty').$type<Difficulty>().notNull(),
    category: text('category').$type<Category>().notNull().default('none'),
    /** Monday = 1 ... Sunday = 64. */
    weekdays: integer('weekdays').notNull().default(127),
    /** 'HH:MM' local time, or null for no reminder. */
    reminderTime: text('reminder_time'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Local date the habit was created; day close skips earlier days (DECISIONS.md D17). */
    createdDate: text('created_date').notNull(),
    archivedAt: text('archived_at'),
    deletedAt: text('deleted_at'),
    clientUpdatedAt: text('client_updated_at').notNull(),
    serverSeq: serverSeq(),
  },
  (t) => [index('habits_user_order').on(t.userId, t.sortOrder)],
);

/** Insert-only ledger; an undo sets undone_at, which never goes back to null. */
export const completions = sqliteTable(
  'completions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id),
    localDate: text('local_date').notNull(),
    completedAt: text('completed_at').notNull(),
    category: text('category').$type<Category>().notNull(),
    xpAwarded: integer('xp_awarded').notNull(),
    goldAwarded: integer('gold_awarded').notNull(),
    bossDamage: integer('boss_damage').notNull(),
    isLate: bool('is_late').notNull().default(false),
    undoneAt: text('undone_at'),
    serverSeq: serverSeq(),
  },
  (t) => [
    uniqueIndex('one_completion_per_habit_day')
      .on(t.habitId, t.localDate)
      .where(sql`${t.undoneAt} is null`),
    index('completions_user_date').on(t.userId, t.localDate),
  ],
);

export const dayClosures = sqliteTable(
  'day_closures',
  {
    userId: text('user_id').notNull(),
    localDate: text('local_date').notNull(),
    closedAt: text('closed_at').notNull(),
    hpLost: integer('hp_lost').notNull(),
    /** JSON: game-core MissedHabit[]. */
    missed: text('missed', { mode: 'json' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.localDate] })],
);

export const inventory = sqliteTable(
  'inventory',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemId: text('item_id').$type<GearId>().notNull(),
    equipped: bool('equipped').notNull().default(false),
    purchasedAt: text('purchased_at').notNull(),
    serverSeq: serverSeq(),
  },
  (t) => [uniqueIndex('inventory_user_item').on(t.userId, t.itemId)],
);

// Party read-models: the server owns them and the app only displays them (section 8.3).
export const parties = sqliteTable('parties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  timezone: text('timezone').notNull(),
});

export const partyMembers = sqliteTable(
  'party_members',
  {
    partyId: text('party_id').notNull(),
    userId: text('user_id').notNull(),
    heroName: text('hero_name').notNull(),
    heroClass: text('class').$type<HeroClass>().notNull(),
    joinedAt: text('joined_at').notNull(),
    leftAt: text('left_at'),
  },
  (t) => [primaryKey({ columns: [t.partyId, t.userId] })],
);

export const bossWeeks = sqliteTable('boss_weeks', {
  id: text('id').primaryKey(),
  partyId: text('party_id').notNull(),
  weekStart: text('week_start').notNull(),
  bossKey: text('boss_key').$type<BossKey>().notNull(),
  maxHp: integer('max_hp').notNull(),
  currentHp: integer('current_hp').notNull(),
  defeatedAt: text('defeated_at'),
});

export const partyEvents = sqliteTable(
  'party_events',
  {
    id: text('id').primaryKey(),
    partyId: text('party_id').notNull(),
    bossWeekId: text('boss_week_id'),
    userId: text('user_id'),
    kind: text('kind').$type<'damage' | 'boss_attack' | 'victory' | 'join' | 'leave'>().notNull(),
    amount: integer('amount'),
    habitName: text('habit_name'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('party_events_recent').on(t.partyId, t.createdAt)],
);

// Local-only tables (section 8.2).

/** Changes waiting to upload, in order. */
export const outbox = sqliteTable('outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),
  op: text('op').$type<'upsert' | 'delete'>().notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
});

/** A single row: id is always 1. */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  cursor: integer('cursor').notNull().default(0),
  lastSyncAt: text('last_sync_at'),
  deviceId: text('device_id').notNull(),
  userId: text('user_id'),
});

/** A single row: id is always 1. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  reduceMotion: text('reduce_motion').$type<'system' | 'on' | 'off'>().notNull().default('system'),
  onboardingDone: bool('onboarding_done').notNull().default(false),
  demoMode: bool('demo_mode').notNull().default(false),
  /** Playing without an account: a real local hero, linked to an account in P3 (D19). */
  localOnly: bool('local_only').notNull().default(false),
  /** The one-time Settings hint after notifications were refused was dismissed (F9). */
  notificationHintSeen: bool('notification_hint_seen').notNull().default(false),
  /** JSON FaintNotice: a faint from day close the player hasn't seen yet (SCOPE.md F4). */
  pendingFaint: text('pending_faint', { mode: 'json' }).$type<FaintNotice>(),
});
