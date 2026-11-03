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
