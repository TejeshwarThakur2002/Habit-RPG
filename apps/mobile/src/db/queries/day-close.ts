// Closing finished days on the phone (SCOPE.md F4, P2 "local day-close on app open"). Until
// P3 there is no server job, so the app closes every day that has passed 03:00 local time
// itself, with the same game-core rules the server will use. From P3 the server's result wins.

import {
  applyHpChange,
  closeDay,
  closeDayStreak,
  datesToClose,
  gearBonuses,
  localDate,
  type ClosingHabit,
  type Faint,
  type Hero,
  type LocalDate,
} from '@habit-rpg/game-core';
import { eq } from 'drizzle-orm';

import { characters, dayClosures, habits } from '../schema';
import type { AppDb, FaintNotice } from '../types';
import { getCharacter, getProfile, listEquippedGear, type Habit } from './hero';
import { completedOn, heroStatsFor } from './quest-board';
import { getSettings, updateSettings } from './settings';

export interface DayCloseSummary {
  closedDates: LocalDate[];
  hpLost: number;
  /** Set when a closed day brought HP to 0. */
  faint: FaintNotice | null;
}

/**
 * Closes every day from the one after `last_closed_date` up to the latest closable day, oldest
 * first, in one transaction. Running it again closes nothing (the day_closures key and
 * `last_closed_date` both guard against repeats). A faint is also kept in settings so the
 * "You fainted" modal still shows if the app closes before the player sees it.
 */
export function closeDays(db: AppDb, userId: string, now: number): DayCloseSummary {
  return db.transaction((tx) => {
    const profile = getProfile(tx, userId);
    const character = getCharacter(tx, userId);
    const summary: DayCloseSummary = { closedDates: [], hpLost: 0, faint: null };
    if (!profile || !character) return summary;

    const tz = profile.timezone;
    const firstDate = localDate(Date.parse(profile.createdAt), tz);
    const dates = datesToClose(now, tz, character.lastClosedDate, firstDate);
    if (dates.length === 0) return summary;

    const ctx = loadContext(tx, userId, tz);
    let hero: Hero = { ...character };
    let streaks = { current: character.currentStreak, longest: character.longestStreak };
    for (const date of dates) {
      const result = closeDay({
        date,
        habits: ctx.habits,
        completedHabitIds: completedOn(tx, userId, date),
        missesToBlock: ctx.missesToBlock,
      });
      const hp = applyHpChange(hero, -result.hpLost, ctx.maxHp);
      hero = hp.hero;
      streaks = closeDayStreak(streaks, result.completionCount);
      if (hp.faint) {
        const missed = result.missed.map((m) => ctx.names.get(m.habitId) ?? 'A quest');
        summary.faint = mergeFaint(summary.faint, date, hp.faint, missed);
      }
      tx.insert(dayClosures)
        .values({
          userId,
          localDate: date,
          closedAt: new Date(now).toISOString(),
          hpLost: result.hpLost,
          missed: result.missed,
        })
        .onConflictDoNothing()
        .run();
      summary.closedDates.push(date);
      summary.hpLost += result.hpLost;
    }

    const { level, xpInLevel, hp, gold } = hero;
    tx.update(characters)
      .set({
        level,
        xpInLevel,
        hp,
        gold,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
        lastClosedDate: dates[dates.length - 1],
      })
      .where(eq(characters.userId, userId))
      .run();
    if (summary.faint) {
      const f = summary.faint;
      updateSettings(tx, { pendingFaint: mergeFaint(getPendingFaint(tx), f.date, f, f.missed) });
    }
    return summary;
  });
}

/** Everything about the hero's habits and gear that stays the same across the closed days. */
function loadContext(db: AppDb, userId: string, tz: string) {
  const all = db.select().from(habits).where(eq(habits.userId, userId)).all();
  return {
    habits: toClosingHabits(all, tz),
    names: new Map(all.map((h) => [h.id, h.name])),
    maxHp: heroStatsFor(db, userId).maxHp,
    missesToBlock: gearBonuses(listEquippedGear(db, userId)).missesToBlock,
  };
}

/** Habits with their archive and delete times as local dates, as game-core expects. */
export function toClosingHabits(rows: readonly Habit[], tz: string): ClosingHabit[] {
  const toDate = (iso: string | null) => (iso ? localDate(Date.parse(iso), tz) : null);
  return rows.map((h) => ({
    ...h,
    archivedDate: toDate(h.archivedAt),
    deletedDate: toDate(h.deletedAt),
  }));
}

/** Several faints before the player looks (e.g. a week away) are shown as one. */
function mergeFaint(
  previous: FaintNotice | null,
  date: LocalDate,
  faint: Pick<Faint, 'goldLost' | 'xpLost'>,
  missed: string[],
): FaintNotice {
  return {
    date,
    goldLost: (previous?.goldLost ?? 0) + faint.goldLost,
    xpLost: (previous?.xpLost ?? 0) + faint.xpLost,
    missed: [...new Set([...(previous?.missed ?? []), ...missed])],
  };
}

/** The faint the player hasn't seen yet, if any. */
export function getPendingFaint(db: AppDb): FaintNotice | null {
  return getSettings(db).pendingFaint ?? null;
}

/** Called when the player closes the "You fainted" modal. */
export function dismissFaint(db: AppDb): void {
  updateSettings(db, { pendingFaint: null });
}
