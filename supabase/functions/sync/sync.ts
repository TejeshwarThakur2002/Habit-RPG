// One sync, in one transaction (DECISIONS.md D35): push the phone's changes, then pull what
// changed since its cursor, and return the authoritative hero.

import type { Sql } from 'postgres';

import type { SyncRequest, SyncResponse } from '../_shared/shared/index.ts';
import { pullChanges } from './pull.ts';
import { assertSupported, pushChanges } from './push.ts';
import { characterOf } from './rows.ts';

export async function runSync(
  sql: Sql,
  userId: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  assertSupported(request.changes);
  return await sql.begin(async (tx) => {
    // Two syncs for one player (two phones, or a retry) take turns, so neither can act on a
    // hero the other is about to change. The lock ends with the transaction.
    await tx`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    // The database's clock, the same one that stamps every row in this transaction.
    const [{ now }] = await tx`select now() as now`;
    const { applied, rejected } = await pushChanges(tx, userId, request.changes);
    const pulled = await pullChanges(tx, userId, request.cursor);
    const [hero] = await tx`
      select *, last_closed_date::text as last_closed_date
      from public.characters where user_id = ${userId}`;
    return {
      cursor: pulled.cursor,
      has_more: pulled.hasMore,
      server_time: (now as Date).toISOString(),
      changes: pulled.changes,
      character: characterOf(hero),
      applied,
      rejected,
    };
  });
}
