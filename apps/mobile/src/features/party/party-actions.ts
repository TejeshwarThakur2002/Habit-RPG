// Party actions go to the server and their answer replaces the stored party (D57, D60). No
// React here, so the route and the tests share it.

import type { PartyRequest } from '@habit-rpg/shared';

import { saveParty } from '@/db/queries/party';
import { getSettings } from '@/db/queries/settings';
import type { AppDb } from '@/db/types';
import { callParty } from '@/lib/supabase';

/** Runs one party action and stores the snapshot it answers with; resolves with an error message, or null. */
export async function runPartyAction(db: AppDb, request: PartyRequest): Promise<string | null> {
  const result = await callParty(request);
  if (!result.ok) return result.message;
  // Signed out while the call was out: nothing to store it for.
  const account = getSettings(db).accountUserId;
  if (account === null) return null;
  saveParty(db, result.state, account, Date.now());
  return null;
}

/**
 * Claims a defeated boss's reward (D58). The +50 gold goes into the hero's event log on the
 * server, so a sync right after brings it to the phone; nothing is added here first (D62).
 */
export async function claimReward(
  db: AppDb,
  bossWeekId: string,
  sync: () => void,
): Promise<string | null> {
  const error = await runPartyAction(db, { action: 'claim_reward', boss_week_id: bossWeekId });
  if (error === null) sync();
  return error;
}
