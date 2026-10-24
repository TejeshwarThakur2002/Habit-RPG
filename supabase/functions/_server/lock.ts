// One player at a time (DECISIONS.md D36): a sync and the nightly job for the same player take
// turns, so neither acts on a hero the other is about to change. A row lock isn't enough,
// because the hero's row may not exist yet.

import type { TransactionSql } from 'postgres';

/** Waits for the player's lock, which the transaction holds until it ends. */
export async function lockPlayer(tx: TransactionSql, userId: string): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
}
