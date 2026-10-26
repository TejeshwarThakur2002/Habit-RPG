import { describe, expect, it } from 'vitest';

import { MAX_CHANGES, changeSchema, syncRequestSchema } from './sync-changes.ts';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const HABIT = '0b6f7a3e-3d6c-4a43-9a4a-8f2d1b2c3d4e';
const AT = '2026-10-23T14:00:00Z';

const habit = {
  table: 'habits',
  op: 'upsert',
  id: HABIT,
  client_updated_at: AT,
  data: {
    name: '  Read​ 20 pages ',
    type: 'daily',
    difficulty: 'medium',
    category: 'mind',
    weekdays: 127,
    reminder_time: '20:00',
    sort_order: 0,
    created_date: '2026-10-20',
    archived_at: null,
    deleted_at: null,
  },
};
const completion = {
  table: 'completions',
  op: 'upsert',
  id: ID,
  client_updated_at: AT,
  data: { habit_id: HABIT, local_date: '2026-10-23', completed_at: AT, undone_at: null },
};
const purchase = {
  table: 'inventory',
  op: 'upsert',
  id: ID,
  client_updated_at: AT,
  data: { item_id: 'oak-shield', equipped: true, purchased_at: AT },
};
const profile = {
  table: 'profiles',
  op: 'upsert',
  id: 'me',
  client_updated_at: AT,
  data: { hero_name: ' Ada ', class: 'mage', timezone: 'America/Toronto' },
};
const request = (changes: unknown[]) => ({
  device_id: ID,
  cursor: 0,
  app_version: '0.1.0',
  changes,
});

describe('syncRequestSchema', () => {
  it('accepts every kind of change the phone sends, cleaning names on the way', () => {
    const undoPurchase = { table: 'inventory', op: 'delete', id: ID, client_updated_at: AT };
    const parsed = syncRequestSchema.parse(
      request([profile, habit, completion, purchase, undoPurchase]),
    );
    expect(parsed.changes).toHaveLength(5);
    expect(parsed.changes[0]).toMatchObject({ data: { hero_name: 'Ada' } });
    expect(parsed.changes[1]).toMatchObject({ data: { name: 'Read 20 pages' } });
  });

  it(`refuses more than ${MAX_CHANGES} changes in one request`, () => {
    expect(syncRequestSchema.safeParse(request(Array(MAX_CHANGES).fill(habit))).success).toBe(true);
    expect(syncRequestSchema.safeParse(request(Array(MAX_CHANGES + 1).fill(habit))).success).toBe(
      false,
    );
  });

  it('takes an optional import of a linked hero, with its start time', () => {
    const imported = { ...request([profile]), import: { started_at: AT, done: false } };
    expect(syncRequestSchema.parse(imported).import).toEqual({ started_at: AT, done: false });
    expect(syncRequestSchema.safeParse({ ...imported, import: { done: true } }).success).toBe(
      false,
    );
    expect(
      syncRequestSchema.safeParse({ ...imported, import: { started_at: AT, done: true, xp: 1 } })
        .success,
    ).toBe(false);
  });

  it("can ask for the import to replace the account's hero", () => {
    const replacing = {
      ...request([profile]),
      import: { started_at: AT, done: true, replace: true },
    };
    expect(syncRequestSchema.parse(replacing).import?.replace).toBe(true);
    expect(
      syncRequestSchema.safeParse({ ...replacing, import: { ...replacing.import, replace: 'yes' } })
        .success,
    ).toBe(false);
  });

  it('refuses a negative cursor and a device id that is not a UUID', () => {
    expect(syncRequestSchema.safeParse({ ...request([]), cursor: -1 }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ ...request([]), device_id: 'phone' }).success).toBe(false);
  });
});

describe('changeSchema', () => {
  const refuses = (change: unknown) => expect(changeSchema.safeParse(change).success).toBe(false);

  it('never takes rewards or other server fields from the phone', () => {
    refuses({ ...completion, data: { ...completion.data, xp_awarded: 9999 } });
    refuses({ ...completion, data: { ...completion.data, user_id: HABIT } });
    refuses({ ...habit, server_seq: 1 });
    refuses({ table: 'characters', op: 'upsert', id: ID, client_updated_at: AT, data: {} });
  });

  it('checks each field', () => {
    refuses({ ...habit, data: { ...habit.data, name: '   ' } });
    refuses({ ...habit, data: { ...habit.data, type: 'monthly' } });
    refuses({ ...habit, data: { ...habit.data, weekdays: 128 } });
    refuses({ ...habit, data: { ...habit.data, reminder_time: '7pm' } });
    refuses({ ...completion, data: { ...completion.data, local_date: '23/10/2026' } });
    refuses({ ...completion, data: { ...completion.data, completed_at: 'yesterday' } });
    refuses({ ...purchase, data: { ...purchase.data, item_id: 'golden-crown' } });
    refuses({ ...profile, data: { ...profile.data, hero_name: 'A' } });
    refuses({ ...profile, data: { ...profile.data, timezone: 'Mars/Olympus' } });
  });

  it('only lets a purchase be deleted; habits use tombstones and completions undo', () => {
    const del = (table: string) => ({ table, op: 'delete', id: ID, client_updated_at: AT });
    expect(changeSchema.safeParse(del('inventory')).success).toBe(true);
    refuses(del('habits'));
    refuses(del('completions'));
  });
});
