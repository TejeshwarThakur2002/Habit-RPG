// What the Party tab says (SCOPE.md section 5.5; D61): battle-log lines and the stale banner.
// Plain functions of the stored party and the time, so the tests pin the wording.

import { BOSS_NAMES } from '@habit-rpg/game-core';
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
