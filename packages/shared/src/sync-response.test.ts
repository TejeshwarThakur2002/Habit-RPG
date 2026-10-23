import { describe, expect, it } from 'vitest';

import { syncResponseSchema } from './sync-response.ts';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const AT = '2026-10-23T14:00:00Z';
const server = { server_seq: 42, updated_at: AT };

const response = {
  cursor: 42,
  has_more: false,
  server_time: AT,
  changes: [
    {
      table: 'completions',
      op: 'upsert',
      data: {
        id: ID,
        habit_id: ID,
        local_date: '2026-10-23',
        completed_at: AT,
        undone_at: null,
        category: 'mind',
        xp_awarded: 21,
        gold_awarded: 6,
        boss_damage: 21,
        is_late: false,
        ...server,
      },
    },
    {
      table: 'day_closures',
      op: 'upsert',
      data: {
        local_date: '2026-10-22',
        closed_at: AT,
        hp_lost: 6,
        missed: [{ habitId: ID, hpLoss: 6, blocked: false, slip: false }],
        ...server,
      },
    },
    { table: 'inventory', op: 'delete', id: ID },
  ],
  character: {
    level: 2,
    xp_in_level: 21,
    hp: 44,
    gold: 31,
    current_streak: 1,
    longest_streak: 3,
    last_closed_date: '2026-10-22',
  },
  applied: [ID, 'me'],
  rejected: [{ id: ID, table: 'inventory', reason: 'insufficient_gold' }],
};

describe('syncResponseSchema', () => {
  it('reads a full response: changed rows, the hero and what happened to each change', () => {
    expect(syncResponseSchema.parse(response)).toEqual(response);
  });

  it('only knows the rejection reasons from SCOPE.md section 8.3', () => {
    const odd = { ...response, rejected: [{ id: ID, table: 'habits', reason: 'nope' }] };
    expect(syncResponseSchema.safeParse(odd).success).toBe(false);
  });

  it('refuses a hero that breaks the rules, such as negative gold', () => {
    const broken = { ...response, character: { ...response.character, gold: -1 } };
    expect(syncResponseSchema.safeParse(broken).success).toBe(false);
  });
});
