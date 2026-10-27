// Generated from packages/shared/src/party.ts by scripts/copy-functions-shared.mjs.
// Do not edit; change the source and run `pnpm functions:shared`.

// The `party` Edge Function's contract (SCOPE.md section 9.2; D56, D57): the actions the phone
// sends and the party snapshot every action answers with. Parties are online-only and
// server-owned; the phone stores the snapshot and shows it.

import { BOSS_ROSTER, normalisePartyCode } from '@habit-rpg/game-core';
import { z } from 'zod';

import { localDate, profileData, timestamp, uuid } from './sync-changes.ts';
import { cleanText } from './text.ts';

export const partyNameSchema = z.string().transform(cleanText).pipe(z.string().min(3).max(24));

/** Any case and spacing; the server compares the normalised code. */
export const partyCodeSchema = z
  .string()
  .max(16)
  .transform((input, ctx) => {
    const code = normalisePartyCode(input);
    if (code === null) {
      ctx.addIssue({ code: 'custom', message: 'Codes are 6 letters and digits' });
      return z.NEVER;
    }
    return code;
  });

export const partyRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('create'), name: partyNameSchema }),
  z.strictObject({ action: z.literal('join'), code: partyCodeSchema }),
  z.strictObject({ action: z.literal('leave') }),
  /** The current snapshot, with no change (D56). */
  z.strictObject({ action: z.literal('state') }),
  /** +50 gold for a defeated boss, once (D58). */
  z.strictObject({ action: z.literal('claim_reward'), boss_week_id: uuid }),
]);

export const PARTY_REFUSALS = [
  'not_found',
  'party_full',
  'already_in_party',
  'not_in_party',
  'no_hero',
  'rate_limited',
  'not_defeated',
  'already_claimed',
] as const;
export type PartyRefusal = (typeof PARTY_REFUSALS)[number];

export const PARTY_EVENT_KINDS = [
  'damage',
  'undo',
  'boss_attack',
  'victory',
  'join',
  'leave',
] as const;

/** A member as the Party screen shows them; a hero that no longer exists has no name. */
export const partyMemberSchema = z.strictObject({
  user_id: uuid,
  hero_name: z.string().nullable(),
  class: profileData.shape.class.nullable(),
  active: z.boolean(),
  /** Damage dealt to this week's boss, net of undone completions. */
  damage: z.int().min(0),
});

export const partyBossSchema = z.strictObject({
  id: uuid,
  boss_key: z.enum(BOSS_ROSTER),
  week_start: localDate,
  max_hp: z.int().min(1),
  current_hp: z.int().min(0),
  defeated_at: timestamp.nullable(),
  /** Days left in the party week, today included: 7 on Monday, 1 on Sunday. */
  days_left: z.int().min(1).max(7),
});

export const partyEventSchema = z.strictObject({
  id: uuid,
  kind: z.enum(PARTY_EVENT_KINDS),
  user_id: uuid.nullable(),
  amount: z.int().min(0).nullable(),
  habit_name: z.string().nullable(),
  created_at: timestamp,
});

export const partyStateSchema = z.strictObject({
  /** Null when the player isn't in a party. */
  party: z
    .strictObject({
      id: uuid,
      name: z.string(),
      code: z.string(),
      timezone: z.string(),
      members: z.array(partyMemberSchema),
      boss: partyBossSchema.nullable(),
      /** The latest 20, newest first. */
      events: z.array(partyEventSchema).max(20),
      /** Whether this player has claimed this boss's reward. */
      claimed: z.boolean(),
    })
    .nullable(),
});

export type PartyRequest = z.infer<typeof partyRequestSchema>;
export type PartyState = z.infer<typeof partyStateSchema>;
export type PartyMember = z.infer<typeof partyMemberSchema>;
export type PartyBoss = z.infer<typeof partyBossSchema>;
export type PartyEvent = z.infer<typeof partyEventSchema>;
