// Closing finished days on the server (SCOPE.md section 9.3), with the same game-core rules as
// the phone's closeDays (D23): each missed quest costs HP unless gear blocks it, 0 HP faints
// the hero, and a day with any completion extends the streak. The server's result wins over
// the phone's (section 8.3). Every HP change goes through the event log (D38).

import type { TransactionSql } from 'postgres';

import {
  applyHpChange,
  closeDay,
  closeDayStreak,
  datesToClose,
  localDate,
  voidedPenalty,
  type Hero,
  type LocalDate,
  type MissedHabit,
} from '../_shared/game-core/index.ts';
import { loadHabits, type ServerHabit } from './habits.ts';
import { changeHero, loadHero, loadStats } from './hero.ts';

interface Context {
  userId: string;
  habits: ServerHabit[];
  maxHp: number;
  missesToBlock: number;
}

/**
 * Closes one day: stores its day_closures row and takes the HP as a `miss` event keyed by the
 * player and the day. Returns the hero afterwards and how many quests were done that day, or
 * null when the day was already closed.
 */
async function closeOne(sql: TransactionSql, ctx: Context, date: LocalDate, hero: Hero) {
  const done = await sql`
    select habit_id from public.completions
    where user_id = ${ctx.userId} and local_date = ${date} and undone_at is null`;
  const result = closeDay({
    date,
    habits: ctx.habits,
    completedHabitIds: new Set(done.map((r) => r.habit_id as string)),
    missesToBlock: ctx.missesToBlock,
  });
  const inserted = await sql`
    insert into public.day_closures (user_id, local_date, hp_lost, missed)
    values (${ctx.userId}, ${date}, ${result.hpLost}, ${sql.json(result.missed as never)})
    on conflict do nothing
    returning local_date`;
  if (inserted.length === 0) return null;

  let after = hero;
  if (result.hpLost > 0) {
    // At 0 HP applyHpChange also faints the hero, which the same event records.
    const { hero: hurt } = applyHpChange(hero, -result.hpLost, ctx.maxHp);
    const ref = `${ctx.userId}:${date}`;
    if (await changeHero(sql, ctx.userId, { kind: 'miss', ref }, hero, hurt)) after = hurt;
  }
  return { hero: after, completionCount: result.completionCount };
}

/**
 * Closes every day from the one after last_closed_date up to the latest one that has passed
 * 03:00 in the player's zone, oldest first, and returns them. Running it again closes nothing:
 * last_closed_date moves on, and the day_closures key refuses a repeat.
 */
export async function closeDays(
  sql: TransactionSql,
  userId: string,
  now: Date,
): Promise<LocalDate[]> {
  const [profile] =
    await sql`select timezone, created_at from public.profiles where id = ${userId}`;
  const state = await loadHero(sql, userId);
  if (!profile || !state) return [];
  const timeZone = profile.timezone as string;
  const firstDate = localDate((profile.created_at as Date).getTime(), timeZone);
  const dates = datesToClose(now.getTime(), timeZone, state.lastClosedDate, firstDate);
  if (dates.length === 0) return [];

  // As on the phone, gear and max HP are taken as they are now for every day being closed.
  const { stats, gear } = await loadStats(sql, userId, state.longestStreak);
  const ctx: Context = {
    userId,
    habits: await loadHabits(sql, userId, timeZone),
    maxHp: stats.maxHp,
    missesToBlock: gear.missesToBlock,
  };
  let hero = state.hero;
  let streaks = { current: state.currentStreak, longest: state.longestStreak };
  for (const date of dates) {
    const closed = await closeOne(sql, ctx, date, hero);
    if (!closed) continue;
    hero = closed.hero;
    streaks = closeDayStreak(streaks, closed.completionCount);
  }
  await sql`
    update public.characters
    set current_streak = ${streaks.current}, longest_streak = ${streaks.longest},
        last_closed_date = ${dates[dates.length - 1]!}
    where user_id = ${userId}`;
  return dates;
}

/**
 * A late completion for a closed day takes back that day's HP penalty for its quest (SCOPE.md
 * section 3, "Late sync"). Once only: the event is keyed by the player, the day and the quest,
 * so completing, undoing and completing again can't refill HP twice.
 */
export async function voidPenalty(
  sql: TransactionSql,
  userId: string,
  date: LocalDate,
  habitId: string,
): Promise<void> {
  const [closure] = await sql`
    select missed from public.day_closures where user_id = ${userId} and local_date = ${date}`;
  if (!closure) return;
  const hpBack = voidedPenalty(closure.missed as MissedHabit[], habitId);
  const state = await loadHero(sql, userId);
  if (hpBack === 0 || !state) return;
  const { stats } = await loadStats(sql, userId, state.longestStreak);
  const { hero } = applyHpChange(state.hero, hpBack, stats.maxHp);
  const ref = `${userId}:${date}:${habitId}`;
  await changeHero(sql, userId, { kind: 'void', ref }, state.hero, hero);
}
