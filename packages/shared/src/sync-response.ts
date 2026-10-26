// What the `sync` Edge Function sends back (SCOPE.md section 8.3): the rows changed since the
// phone's cursor, the authoritative hero, and what happened to each pushed change.

import { z } from 'zod';

import {
  completionData,
  habitData,
  inventoryData,
  localDate,
  profileData,
  timestamp,
  uuid,
} from './sync-changes.ts';

/** Section 8.3's reasons a change can be refused; the phone rolls the change back. */
export const REJECTION_REASONS = [
  'duplicate',
  'not_scheduled',
  'date_out_of_range',
  'insufficient_gold',
  'invalid',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** The server's hero, which replaces the phone's estimate after every sync. */
export const characterSchema = z.strictObject({
  level: z.int().min(1),
  xp_in_level: z.int().min(0),
  hp: z.int().min(0),
  gold: z.int().min(0),
  current_streak: z.int().min(0),
  longest_streak: z.int().min(0),
  last_closed_date: localDate.nullable(),
});

// Rows as the server stores them: what the phone sent plus the server's own columns.
const serverColumns = { server_seq: z.int().min(1), updated_at: timestamp };

const pulled = <T extends string, S extends z.ZodRawShape>(table: T, shape: S) =>
  z.strictObject({
    table: z.literal(table),
    op: z.literal('upsert'),
    data: z.strictObject({ ...shape, ...serverColumns }),
  });

export const serverChangeSchema = z.union([
  pulled('profiles', { id: uuid, ...profileData.shape, created_at: timestamp }),
  pulled('habits', { id: uuid, ...habitData.shape, client_updated_at: timestamp }),
  pulled('completions', {
    id: uuid,
    ...completionData.shape,
    category: habitData.shape.category,
    xp_awarded: z.int().min(0),
    gold_awarded: z.int().min(0),
    boss_damage: z.int().min(0),
    is_late: z.boolean(),
  }),
  pulled('inventory', { id: uuid, ...inventoryData.shape }),
  pulled('day_closures', {
    local_date: localDate,
    closed_at: timestamp,
    hp_lost: z.int().min(0),
    // game-core's MissedHabit objects, stored as JSON as they are (camelCase inside).
    missed: z.array(
      z.strictObject({
        habitId: uuid,
        hpLoss: z.int().min(0),
        blocked: z.boolean(),
        slip: z.boolean(),
      }),
    ),
  }),
  // Removed on the server (an undone purchase); the phone deletes its copy.
  z.strictObject({ table: z.literal('inventory'), op: z.literal('delete'), id: uuid }),
]);

export const syncResponseSchema = z.strictObject({
  /** The new cursor: the highest server_seq included so far. */
  cursor: z.int().min(0),
  /** More rows are waiting: sync again straight away (pages of 500). */
  has_more: z.boolean(),
  server_time: timestamp,
  changes: z.array(serverChangeSchema),
  character: characterSchema,
  /** Ids of pushed changes that were accepted (or were already there). */
  applied: z.array(z.string()),
  rejected: z.array(
    z.strictObject({ id: z.string(), table: z.string(), reason: z.enum(REJECTION_REASONS) }),
  ),
});

/** Why the server refused a whole sync and applied none of it (D42, D49). */
export const REFUSAL_CODES = [
  'hero_exists',
  'hero_replaced',
  'import_in_progress',
  'bad_import',
] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

/** The account's hero as `hero_exists` describes it, so the phone can show both (D49). */
export const accountHeroSchema = z.strictObject({
  hero_name: profileData.shape.hero_name,
  class: profileData.shape.class,
  level: z.int().min(1),
});

/**
 * The body of any 4xx answer. `error` is one of REFUSAL_CODES or a short message, such as
 * "Invalid request", which may come with more fields.
 */
export const syncRefusalSchema = z.object({
  error: z.string(),
  hero: accountHeroSchema.optional(),
});

export type ServerChange = z.infer<typeof serverChangeSchema>;
export type SyncResponse = z.infer<typeof syncResponseSchema>;
export type Character = z.infer<typeof characterSchema>;
export type AccountHero = z.infer<typeof accountHeroSchema>;
export type SyncRefusal = z.infer<typeof syncRefusalSchema>;
