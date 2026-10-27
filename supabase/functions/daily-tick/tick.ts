// One run of the nightly job (SCOPE.md section 9.3): close the finished days of every player
// who has one, each in their own transaction behind the same lock as `sync`, with the boss's
// hits for party members; then start this week's bosses and remove long-empty parties (D59).

import type { Sql } from 'postgres';

import { closeDays } from '../_server/close-days.ts';
import { lockPlayer } from '../_server/lock.ts';
import { bossAttacks, removeEmptyParties, rolloverBosses } from './parties.ts';

/** Players per run; the rest wait for the next hourly run, oldest unclosed day first. */
export const MAX_PLAYERS = 500;

export interface TickResult {
  players: number;
  days: number;
  failed: number;
  has_more: boolean;
  /** This week's bosses started, and empty parties removed. */
  bosses: number;
  parties_removed: number;
}

/**
 * Players who may have a day to close: yesterday in their zone hasn't closed yet. This is a
 * coarse filter; game-core's datesToClose decides which days have passed 03:00.
 */
async function duePlayers(sql: Sql): Promise<string[]> {
  const rows = await sql`
    select p.id from public.profiles p
    join public.characters c on c.user_id = p.id
    where coalesce(c.last_closed_date + 1, (p.created_at at time zone p.timezone)::date)
          < (now() at time zone p.timezone)::date
    order by c.last_closed_date nulls first, p.id
    limit ${MAX_PLAYERS + 1}`;
  return rows.map((r) => r.id as string);
}

export async function runTick(sql: Sql): Promise<TickResult> {
  const [{ now }] = await sql`select now() as now`;
  const due = await duePlayers(sql);
  const result: TickResult = {
    players: 0,
    days: 0,
    failed: 0,
    has_more: due.length > MAX_PLAYERS,
    bosses: 0,
    parties_removed: 0,
  };
  for (const userId of due.slice(0, MAX_PLAYERS)) {
    try {
      const closed = await sql.begin(async (tx) => {
        await lockPlayer(tx, userId);
        const dates = await closeDays(tx, userId, now as Date);
        await bossAttacks(tx, userId, dates);
        return dates;
      });
      if (closed.length > 0) result.players += 1;
      result.days += closed.length;
    } catch (e: unknown) {
      // One player's failure must not stop the others; it is retried on the next run.
      result.failed += 1;
      console.error('daily-tick: closing failed', userId, e instanceof Error ? e.message : e);
    }
  }
  result.bosses = await rolloverBosses(sql, now as Date);
  result.parties_removed = await removeEmptyParties(sql, now as Date);
  return result;
}
