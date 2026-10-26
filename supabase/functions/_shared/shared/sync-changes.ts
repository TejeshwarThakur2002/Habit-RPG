// Generated from packages/shared/src/sync-changes.ts by scripts/copy-functions-shared.mjs.
// Do not edit; change the source and run `pnpm functions:shared`.

// What the phone sends to the `sync` Edge Function (SCOPE.md section 8.3). The wire format is
// snake_case, like the database. Only fields the player controls are accepted: rewards, the
// hero and anything else the server decides are never taken from the phone (D35).

import { GEAR, parseTime, type GearId } from '@habit-rpg/game-core';
import { z } from 'zod';

import { cleanText, isValidTimeZone } from './text.ts';

/** SCOPE.md section 9.6: at most 200 changes per request. */
export const MAX_CHANGES = 200;

export const uuid = z.uuid();
export const timestamp = z.iso.datetime({ offset: true });
export const localDate = z.iso.date();
const time = z.string().refine((t) => parseTime(t) !== null, 'Use HH:MM');
const gearIds = GEAR.map((g) => g.id) as [GearId, ...GearId[]];

export const heroNameSchema = z.string().transform(cleanText).pipe(z.string().min(2).max(20));
export const habitNameSchema = z.string().transform(cleanText).pipe(z.string().min(1).max(60));
export const timeZoneSchema = z.string().refine(isValidTimeZone, 'Unknown time zone');

export const profileData = z.strictObject({
  hero_name: heroNameSchema,
  class: z.enum(['knight', 'mage', 'rogue']),
  timezone: timeZoneSchema,
});

export const habitData = z.strictObject({
  name: habitNameSchema,
  type: z.enum(['daily', 'weekdays', 'bad']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.enum(['body', 'mind', 'health', 'none']),
  weekdays: z.int().min(0).max(127),
  reminder_time: time.nullable(),
  sort_order: z.int().min(0),
  created_date: localDate,
  archived_at: timestamp.nullable(),
  deleted_at: timestamp.nullable(),
});

/** The server works out category, XP, gold and boss damage itself (section 8.3). */
export const completionData = z.strictObject({
  habit_id: uuid,
  local_date: localDate,
  completed_at: timestamp,
  undone_at: timestamp.nullable(),
});

export const inventoryData = z.strictObject({
  item_id: z.enum(gearIds),
  equipped: z.boolean(),
  purchased_at: timestamp,
});

const upsert = <T extends string, D extends z.ZodType>(table: T, data: D) =>
  z.strictObject({
    table: z.literal(table),
    op: z.literal('upsert'),
    id: uuid,
    data,
    client_updated_at: timestamp,
  });

/**
 * One change from the phone's outbox. Habits are never deleted (a delete is a `deleted_at`
 * tombstone) and completions are only ever inserted or undone, so `delete` exists only for
 * undoing a purchase. The profile's id is the signed-in user, taken from the token.
 */
export const changeSchema = z.union([
  upsert('profiles', profileData).extend({ id: z.literal('me') }),
  upsert('habits', habitData),
  upsert('completions', completionData),
  upsert('inventory', inventoryData),
  z.strictObject({
    table: z.literal('inventory'),
    op: z.literal('delete'),
    id: uuid,
    client_updated_at: timestamp,
  }),
]);

/**
 * A linked local hero's history, sent once in time order over several requests (D35, D42).
 * `started_at` is when the hero was made on the phone; the request with `done` ends it.
 * `replace` is the player's choice to keep this phone's hero when the account already has
 * one: the server deletes the account's game data first, never the login (D48, D49).
 */
export const importSchema = z.strictObject({
  started_at: timestamp,
  done: z.boolean(),
  replace: z.boolean().optional(),
});

export const syncRequestSchema = z.strictObject({
  device_id: uuid,
  /** The highest server_seq the phone has applied; 0 before the first sync. */
  cursor: z.int().min(0),
  app_version: z.string().min(1).max(32),
  changes: z.array(changeSchema).max(MAX_CHANGES),
  import: importSchema.optional(),
});

export type Change = z.infer<typeof changeSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
