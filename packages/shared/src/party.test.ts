import { describe, expect, it } from 'vitest';

import { partyRequestSchema, partyStateSchema } from './party.ts';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const AT = '2026-10-27T14:00:00Z';

describe('partyRequestSchema', () => {
  it('cleans a party name and keeps it to 3 to 24 characters', () => {
    expect(partyRequestSchema.parse({ action: 'create', name: '  Night   Owls ' })).toEqual({
      action: 'create',
      name: 'Night Owls',
    });
    expect(partyRequestSchema.safeParse({ action: 'create', name: 'No' }).success).toBe(false);
    expect(partyRequestSchema.safeParse({ action: 'create', name: 'x'.repeat(25) }).success).toBe(
      false,
    );
  });

  it('takes a code in any case, and refuses one with I or O', () => {
    expect(partyRequestSchema.parse({ action: 'join', code: ' k7m2qx ' })).toEqual({
      action: 'join',
      code: 'K7M2QX',
    });
    expect(partyRequestSchema.safeParse({ action: 'join', code: 'K7M2QI' }).success).toBe(false);
  });

  it('knows only its four actions, with nothing extra', () => {
    expect(partyRequestSchema.safeParse({ action: 'leave' }).success).toBe(true);
    expect(partyRequestSchema.safeParse({ action: 'state' }).success).toBe(true);
    expect(partyRequestSchema.safeParse({ action: 'claim_reward' }).success).toBe(false);
    expect(partyRequestSchema.safeParse({ action: 'leave', user_id: ID }).success).toBe(false);
  });
});

describe('partyStateSchema', () => {
  it('reads a party snapshot, or no party', () => {
    const state = {
      party: {
        id: ID,
        name: 'Night Owls',
        code: 'K7M2QX',
        timezone: 'America/Toronto',
        members: [{ user_id: ID, hero_name: 'Ada', class: 'mage', active: true, damage: 42 }],
        boss: {
          id: ID,
          boss_key: 'procrastination-slime',
          week_start: '2026-10-26',
          max_hp: 500,
          current_hp: 458,
          defeated_at: null,
          days_left: 6,
        },
        events: [
          { id: ID, kind: 'damage', user_id: ID, amount: 42, habit_name: 'Read', created_at: AT },
        ],
        claimed: false,
      },
    };
    expect(partyStateSchema.parse(state)).toEqual(state);
    expect(partyStateSchema.parse({ party: null })).toEqual({ party: null });
  });
});
