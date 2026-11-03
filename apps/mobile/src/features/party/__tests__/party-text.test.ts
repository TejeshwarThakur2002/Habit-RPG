import type { PartyEventView, PartyView } from '@/db/queries/party';

import { battleLogLines, staleText } from '../party-text';

// Wednesday 28 October 2026, 12:00 in Toronto.
const NOW = Date.parse('2026-10-28T16:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const event = (over: Partial<PartyEventView>): PartyEventView => ({
  id: 'e',
  kind: 'damage',
  bossWeekId: 'b',
  userId: 'r',
  amount: 20,
  habitName: 'Read 20 pages',
  createdAt: minutesAgo(2),
  ...over,
});

const party = (events: PartyEventView[], fetchedAt: string | null = minutesAgo(1)): PartyView => ({
  id: 'p',
  name: 'Night Owls',
  code: 'K7M2QX',
  timezone: 'America/Toronto',
  fetchedAt,
  members: [
    { userId: 'r', name: 'Mage Ravi', heroClass: 'mage', isYou: false, active: true, damage: 20 },
    { userId: 'x', name: null, heroClass: null, isYou: false, active: false, damage: 0 },
  ],
  events,
  boss: {
    id: 'b',
    bossKey: 'procrastination-slime',
    weekStart: '2026-10-26',
    maxHp: 1000,
    currentHp: 980,
    defeated: false,
    claimed: false,
    daysLeft: 5,
  },
});

const text = (events: PartyEventView[]) =>
  battleLogLines(party(events), NOW).map((line) =>
    line.parts.map((p) => (typeof p === 'string' ? p : `[${p.tone}:${p.text}]`)).join(''),
  );

describe('battleLogLines', () => {
  it('tells each kind of event, members in teal and the boss in red', () => {
    expect(
      text([
        event({ id: '1' }),
        event({ id: '2', kind: 'undo' }),
        event({ id: '3', kind: 'boss_attack', amount: 8, habitName: '30 min workout' }),
        event({ id: '4', kind: 'victory', userId: null, amount: null, habitName: null }),
        event({ id: '5', kind: 'join', amount: null, habitName: null, createdAt: minutesAgo(90) }),
        event({ id: '6', kind: 'leave', userId: 'x', amount: null, habitName: null }),
      ]),
    ).toEqual([
      '[member:Mage Ravi] finished "Read 20 pages" · 20 dmg · 2 min ago',
      '[member:Mage Ravi] undid "Read 20 pages" · 20 dmg back · 2 min ago',
      '[boss:Procrastination Slime] hit [member:Mage Ravi] for 8 · missed "30 min workout" · 2 min ago',
      '[boss:Procrastination Slime] was defeated! · 2 min ago',
      '[member:Mage Ravi] joined the party · 1 h ago',
      '[member:A former member] left the party · 2 min ago',
    ]);
  });

  it("names last week's boss without guessing which one it was", () => {
    // The job narrates a day late, so a hit logged this week can be last week's boss's.
    const lastWeek = event({ kind: 'boss_attack', bossWeekId: 'last-week' });
    expect(text([lastWeek])[0]).toMatch(/^\[boss:Last week's boss\] hit/);
  });

  it('names an unknown player a former member', () => {
    expect(text([event({ userId: 'gone-for-good' })])[0]).toMatch(/^\[member:A former member\]/);
  });
});

describe('staleText', () => {
  it('is quiet while the stored party is fresh', () => {
    expect(staleText(party([], minutesAgo(15)), false, NOW)).toBeNull();
  });

  it('speaks up after 15 minutes or a failed refresh', () => {
    expect(staleText(party([], minutesAgo(16)), false, NOW)).toBe(
      'Showing last synced data (16 min ago)',
    );
    expect(staleText(party([], minutesAgo(3 * 60)), false, NOW)).toBe(
      'Showing last synced data (3 h ago)',
    );
    expect(staleText(party([], minutesAgo(1)), true, NOW)).toBe(
      'Showing last synced data (1 min ago)',
    );
  });

  it('has nothing to say about a party never fetched', () => {
    expect(staleText(party([], null), true, NOW)).toBeNull();
  });
});
