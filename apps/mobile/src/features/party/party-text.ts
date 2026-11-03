// What the Party tab says (SCOPE.md section 5.5; D61, D62): battle-log lines, the stale banner
// and the countdown to the next boss.
// Plain functions of the stored party and the time, so the tests pin the wording.

import { BOSS_NAMES, addDays, weekStart, zonedInstant } from '@habit-rpg/game-core';
import type { LogPart } from '@habit-rpg/ui';

import type { PartyEventView, PartyView } from '@/db/queries/party';
import { sinceText } from '@/features/sync/sync-display';

const FORMER = 'A former member';
/** After this long, the stored party may be behind what the server has. */
const STALE_AFTER_MS = 15 * 60_000;

export interface LogLine {
  id: string;
  parts: LogPart[];
}

/** One line per event, newest first; member names in teal and the boss in red. */
export function battleLogLines(party: PartyView, now: number): LogLine[] {
  const names = new Map(party.members.map((m) => [m.userId, m.name ?? FORMER]));
  const member = (e: PartyEventView) => ({
    text: (e.userId && names.get(e.userId)) ?? FORMER,
    tone: 'member' as const,
  });
  // The log can reach back into last week, whose boss the phone no longer has.
  const boss = (e: PartyEventView) => ({
    text:
      party.boss && e.bossWeekId === party.boss.id
        ? BOSS_NAMES[party.boss.bossKey]
        : "Last week's boss",
    tone: 'boss' as const,
  });
  const ago = (e: PartyEventView) => sinceText(e.createdAt, now);
  return party.events.map((e) => {
    const quest = e.habitName ? `"${e.habitName}"` : 'a quest';
    const amount = e.amount ?? 0;
    const parts: LogPart[] = (() => {
      switch (e.kind) {
        case 'damage':
          return [member(e), ` finished ${quest} · ${amount} dmg · ${ago(e)}`];
        case 'undo':
          return [member(e), ` undid ${quest} · ${amount} dmg back · ${ago(e)}`];
        case 'boss_attack':
          return [boss(e), ' hit ', member(e), ` for ${amount} · missed ${quest} · ${ago(e)}`];
        case 'victory':
          return [boss(e), ` was defeated! · ${ago(e)}`];
        case 'join':
          return [member(e), ` joined the party · ${ago(e)}`];
        case 'leave':
          return [member(e), ` left the party · ${ago(e)}`];
      }
    })();
    return { id: e.id, parts };
  });
}

/**
 * "Showing last synced data (3 h ago)" when the last refresh failed or the stored party is old,
 * or null when it is current or was never fetched.
 */
export function staleText(party: PartyView, refreshFailed: boolean, now: number): string | null {
  if (party.fetchedAt === null) return null;
  const old = now - Date.parse(party.fetchedAt) > STALE_AFTER_MS;
  if (!refreshFailed && !old) return null;
  return `Showing last synced data (${sinceText(party.fetchedAt, now)})`;
}

/** "Next boss in 2 d 5 h": the time to Monday 00:00 in the party's own time zone. */
export function nextBossText(timeZone: string, now: number): string {
  const monday = zonedInstant(addDays(weekStart(now, timeZone), 7), 0, 0, timeZone);
  const minutes = Math.max(1, Math.ceil((monday - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `Next boss in ${days} d ${hours} h`;
  if (hours > 0) return `Next boss in ${hours} h ${minutes % 60} min`;
  return `Next boss in ${minutes} min`;
}
