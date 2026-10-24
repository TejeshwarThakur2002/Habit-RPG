// Pushing completions (SCOPE.md section 8.3). The phone says which habit it completed and
// when; the server checks the date and schedule, works out the reward from its own data with
// game-core, and changes the hero only through the event log (DECISIONS.md D38).

import type { TransactionSql } from 'postgres';

import {
  applyXp,
  baseValues,
  computeReward,
  isActiveOn,
  isCompletionDateAllowed,
  isScheduledOn,
  xpBonusFor,
} from '../_shared/game-core/index.ts';
import type { Change } from '../_shared/shared/index.ts';
import { voidPenalty } from '../_server/close-days.ts';
import { loadHabit, type ServerHabit } from '../_server/habits.ts';
import { changeHero, loadHero, loadStats } from '../_server/hero.ts';
import type { Outcome } from './push-habits.ts';

type CompletionChange = Extract<Change, { table: 'completions' }>;

interface StoredCompletion {
  id: string;
  xp_awarded: number;
  gold_awarded: number;
}

/**
 * Marks a completion undone and takes its XP and gold back. XP stops at the start of the
 * current level and the level never drops (section 8.3); gold never goes below 0.
 */
async function undo(sql: TransactionSql, userId: string, row: StoredCompletion, at: string) {
  await sql`update public.completions set undone_at = ${at} where id = ${row.id}`;
  const state = await loadHero(sql, userId);
  if (!state) return;
  const { hero } = applyXp(state.hero, -row.xp_awarded, state.hero.hp);
  const after = { ...hero, gold: Math.max(0, hero.gold - row.gold_awarded) };
  await changeHero(sql, userId, { kind: 'undo', ref: row.id }, state.hero, after);
}

/** A completion the server already has: a retry changes nothing; an undo is applied once. */
async function pushKnown(
  sql: TransactionSql,
  userId: string,
  change: CompletionChange,
  stored: StoredCompletion & { user_id: string; undone_at: Date | null },
): Promise<Outcome> {
  if (stored.user_id !== userId) return { applied: false, reason: 'invalid' };
  if (change.data.undone_at !== null && stored.undone_at === null) {
    await undo(sql, userId, stored, change.data.undone_at);
  }
  return { applied: true };
}

export async function pushCompletion(
  sql: TransactionSql,
  userId: string,
  change: CompletionChange,
  now: Date,
): Promise<Outcome> {
  const { id } = change;
  const d = change.data;
  const [stored] = await sql`
    select id, user_id, undone_at, xp_awarded, gold_awarded
    from public.completions where id = ${id}`;
  if (stored) return await pushKnown(sql, userId, change, stored as never);

  const [profile] = await sql`select timezone from public.profiles where id = ${userId}`;
  const state = await loadHero(sql, userId);
  if (!profile || !state) return { applied: false, reason: 'invalid' };
  const found = await loadHabit(sql, d.habit_id, profile.timezone);
  if (!found || found.owner !== userId) return { applied: false, reason: 'invalid' };
  const { habit } = found;

  if (!isCompletionDateAllowed(d.local_date, now.getTime(), profile.timezone)) {
    return { applied: false, reason: 'date_out_of_range' };
  }
  if (!isActiveOn(habit, d.local_date) || !isScheduledOn(habit, d.local_date)) {
    return { applied: false, reason: 'not_scheduled' };
  }

  // Two phones completed the same habit on the same day: the earliest completion wins.
  const [rival] = await sql`
    select id, completed_at, xp_awarded, gold_awarded from public.completions
    where habit_id = ${d.habit_id} and local_date = ${d.local_date} and undone_at is null`;
  if (rival) {
    if ((rival.completed_at as Date) <= new Date(d.completed_at)) {
      return { applied: false, reason: 'duplicate' };
    }
    await undo(sql, userId, rival as never, now.toISOString());
  }

  await applyNewCompletion(sql, userId, change, habit);
  return { applied: true };
}

async function applyNewCompletion(
  sql: TransactionSql,
  userId: string,
  change: CompletionChange,
  habit: ServerHabit,
): Promise<void> {
  const d = change.data;
  // Rivals may have been undone just now, so the hero is read fresh.
  const state = (await loadHero(sql, userId))!;
  // A day that already closed gets no streak bonus (section 3, day close).
  const isLate = state.lastClosedDate !== null && d.local_date <= state.lastClosedDate;
  const { stats, gear } = await loadStats(sql, userId, state.longestStreak);
  const reward = computeReward({
    base: baseValues(habit.type, habit.difficulty),
    completionId: change.id,
    streakDays: state.currentStreak,
    str: stats.STR,
    int: stats.INT,
    luck: stats.LUCK,
    bonusXpPercent: xpBonusFor(gear, habit.category),
    isLate,
  });
  await sql`
    insert into public.completions (
      id, user_id, habit_id, local_date, completed_at, category,
      xp_awarded, gold_awarded, boss_damage, is_late, undone_at
    ) values (
      ${change.id}, ${userId}, ${d.habit_id}, ${d.local_date}, ${d.completed_at},
      ${habit.category}, ${reward.xp}, ${reward.gold}, ${reward.bossDamage}, ${isLate},
      ${d.undone_at}
    )`;
  // Completed and undone on the phone before it ever synced: kept for the record, no effect.
  if (d.undone_at !== null) return;

  // Max HP after this completion, which may have added a CON point (as on the phone).
  const { stats: after } = await loadStats(sql, userId, state.longestStreak);
  const { hero } = applyXp(state.hero, reward.xp, after.maxHp);
  const next = { ...hero, gold: hero.gold + reward.gold };
  await changeHero(sql, userId, { kind: 'complete', ref: change.id }, state.hero, next);
  if (isLate) await voidPenalty(sql, userId, d.local_date, habit.id);
}
