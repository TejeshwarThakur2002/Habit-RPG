// The sync contract (packages/shared) as Edge Functions load it: the copy in _shared, with
// `zod` from npm and game-core from its own copy (D35).

import { assert, assertEquals } from '@std/assert';

import { syncRequestSchema, syncResponseSchema } from '../_shared/shared/index.ts';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const AT = '2026-10-23T14:00:00Z';

Deno.test('a sync request parses on Deno, and names are cleaned like on the phone', () => {
  const parsed = syncRequestSchema.parse({
    device_id: ID,
    cursor: 0,
    app_version: '0.1.0',
    changes: [
      {
        table: 'profiles',
        op: 'upsert',
        id: 'me',
        client_updated_at: AT,
        data: { hero_name: ' Ada​ ', class: 'mage', timezone: 'Pacific/Auckland' },
      },
    ],
  });
  assertEquals(parsed.changes[0], {
    table: 'profiles',
    op: 'upsert',
    id: 'me',
    client_updated_at: AT,
    data: { hero_name: 'Ada', class: 'mage', timezone: 'Pacific/Auckland' },
  });
});

Deno.test('rewards sent by the phone are refused on the server too', () => {
  const result = syncRequestSchema.safeParse({
    device_id: ID,
    cursor: 0,
    app_version: '0.1.0',
    changes: [
      {
        table: 'completions',
        op: 'upsert',
        id: ID,
        client_updated_at: AT,
        data: {
          habit_id: ID,
          local_date: '2026-10-23',
          completed_at: AT,
          undone_at: null,
          xp_awarded: 9999,
        },
      },
    ],
  });
  assert(!result.success);
});

Deno.test('an empty response parses', () => {
  const response = {
    cursor: 0,
    has_more: false,
    server_time: AT,
    changes: [],
    character: {
      level: 1,
      xp_in_level: 0,
      hp: 44,
      gold: 0,
      current_streak: 0,
      longest_streak: 0,
      last_closed_date: null,
    },
    applied: [],
    rejected: [],
  };
  assertEquals(syncResponseSchema.parse(response), response);
});
