// One sync, in one transaction (DECISIONS.md D35): push the phone's changes, then pull what
// changed since its cursor, and return the authoritative hero.

import type { Sql } from 'postgres';

import type { SyncRequest, SyncResponse } from '../_shared/shared/index.ts';
import { lockPlayer } from '../_server/lock.ts';
import { checkImport, finishImport, markReplaced, replaceHero } from './import.ts';
import { pullChanges } from './pull.ts';
import { pushChanges } from './push.ts';
import { characterOf } from './rows.ts';

export async function runSync(
  sql: Sql,
  userId: string,
  request: SyncRequest,
): Promise<SyncResponse> {
  return await sql.begin(async (tx) => {
    await lockPlayer(tx, userId);
    // The database's clock, the same one that stamps every row in this transaction.
    const [{ now }] = await tx`select now() as now`;
    const replacing = await checkImport(tx, userId, request, now as Date);
    // The player chose this phone's hero over the account's (D49): out with the old one.
    const replacedSeq = replacing ? await replaceHero(tx, userId) : null;
    const imported = request.import && { ...request.import, device_id: request.device_id };
    const { applied, rejected } = await pushChanges(
      tx,
      userId,
      request.changes,
      now as Date,
      imported,
    );
    if (replacedSeq !== null) await markReplaced(tx, userId, replacedSeq);
    if (request.import?.done) await finishImport(tx, userId, now as Date);
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
