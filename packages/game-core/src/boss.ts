// Parties and weekly bosses (SCOPE.md sections 3 and 9.2).

import { addDays, localDate, weekday, type LocalDate } from './dates';

/** Rotates weekly in this order; "Monday" is the final boss, then the roster starts again. */
export const BOSS_ROSTER = [
  'procrastination-slime',
  'snooze-goblin',
  'doomscroll-wraith',
  'couch-golem',
  'deadline-dragon',
  'junk-food-ogre',
  'burnout-specter',
  'monday',
] as const;
export type BossKey = (typeof BOSS_ROSTER)[number];

export const BOSS_NAMES: Readonly<Record<BossKey, string>> = {
  'procrastination-slime': 'Procrastination Slime',
  'snooze-goblin': 'Snooze Goblin',
  'doomscroll-wraith': 'Doomscroll Wraith',
  'couch-golem': 'Couch Golem',
  'deadline-dragon': 'Deadline Dragon',
  'junk-food-ogre': 'Junk Food Ogre',
  'burnout-specter': 'Burnout Specter',
  monday: 'Monday',
};

export const BOSS_HP_PER_MEMBER = 500;
export const BOSS_VICTORY_GOLD = 50;
export const MAX_PARTY_SIZE = 4;

/** Boss HP is fixed at the start of the week: 500 per member. */
export function bossMaxHp(memberCount: number): number {
  return BOSS_HP_PER_MEMBER * memberCount;
}

export function nextBoss(previous: BossKey | null): BossKey {
  if (previous === null) return BOSS_ROSTER[0];
  return BOSS_ROSTER[(BOSS_ROSTER.indexOf(previous) + 1) % BOSS_ROSTER.length] as BossKey;
}

/** The Monday that starts the party week containing `now`, in the party's time zone. */
export function weekStart(now: number, timeZone: string): LocalDate {
  const today = localDate(now, timeZone);
  return addDays(today, 1 - weekday(today));
}

/** Days left in the party week including today: 7 on Monday, 1 on Sunday. */
export function daysLeftInWeek(today: LocalDate): number {
  return 8 - weekday(today);
}

export interface BossHit {
  hp: number;
  /** True only for the hit that takes the boss from above 0 to 0. */
  defeatedNow: boolean;
}

export function applyBossDamage(currentHp: number, damage: number): BossHit {
  const hp = Math.max(0, currentHp - damage);
  return { hp, defeatedNow: currentHp > 0 && hp === 0 };
}

/**
 * An undone completion gives its damage back, up to max HP. A defeated boss stays defeated
 * so a victory and its rewards can't be taken away (DECISIONS.md D12).
 */
export function undoBossDamage(currentHp: number, maxHp: number, damage: number): number {
  if (currentHp === 0) return 0;
  return Math.min(maxHp, currentHp + damage);
}

/** Party join codes: 6 characters from A-Z without I and O, and digits 2-9. */
export const PARTY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PARTY_CODE_LENGTH = 6;

/** `randomIndex(n)` must return an integer in [0, n); the server passes a crypto source. */
export function generatePartyCode(randomIndex: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < PARTY_CODE_LENGTH; i += 1) {
    code += PARTY_CODE_ALPHABET[randomIndex(PARTY_CODE_ALPHABET.length)];
  }
  return code;
}

/** Codes are matched case-insensitively; returns the normalised code or null if invalid. */
export function normalisePartyCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  const valid =
    code.length === PARTY_CODE_LENGTH && [...code].every((c) => PARTY_CODE_ALPHABET.includes(c));
  return valid ? code : null;
}
