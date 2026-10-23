// Turning database rows into the wire format of packages/shared (snake_case, ISO strings).
// Postgres.js returns bigints as strings and timestamps as Dates; dates and times are cast
// to text in SQL so no time zone can shift them.

import { newHero } from '../_shared/game-core/index.ts';
import type { Character, ServerChange } from '../_shared/shared/index.ts';

type Row = Record<string, unknown>;

const iso = (value: unknown): string => (value as Date).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null ? null : iso(value));
const seq = (value: unknown): number => Number(value);

const server = (row: Row) => ({ server_seq: seq(row.server_seq), updated_at: iso(row.updated_at) });

export function profileChange(row: Row): ServerChange {
  return {
    table: 'profiles',
    op: 'upsert',
    data: {
      id: row.id as string,
      hero_name: row.hero_name as string,
      class: row.class as 'knight' | 'mage' | 'rogue',
      timezone: row.timezone as string,
      created_at: iso(row.created_at),
      ...server(row),
    },
  };
}

export function habitChange(row: Row): ServerChange {
  return {
    table: 'habits',
    op: 'upsert',
    data: {
      id: row.id as string,
      name: row.name as string,
      type: row.type as 'daily' | 'weekdays' | 'bad',
      difficulty: row.difficulty as 'easy' | 'medium' | 'hard',
      category: row.category as 'body' | 'mind' | 'health' | 'none',
      weekdays: row.weekdays as number,
      reminder_time: row.reminder_time as string | null,
      sort_order: row.sort_order as number,
      created_date: row.created_date as string,
      archived_at: isoOrNull(row.archived_at),
      deleted_at: isoOrNull(row.deleted_at),
      client_updated_at: iso(row.client_updated_at),
      ...server(row),
    },
  };
}

export function completionChange(row: Row): ServerChange {
  return {
    table: 'completions',
    op: 'upsert',
    data: {
      id: row.id as string,
      habit_id: row.habit_id as string,
      local_date: row.local_date as string,
      completed_at: iso(row.completed_at),
      undone_at: isoOrNull(row.undone_at),
      category: row.category as 'body' | 'mind' | 'health' | 'none',
      xp_awarded: row.xp_awarded as number,
      gold_awarded: row.gold_awarded as number,
      boss_damage: row.boss_damage as number,
      is_late: row.is_late as boolean,
      ...server(row),
    },
  };
}

export function inventoryChange(row: Row): ServerChange {
  return {
    table: 'inventory',
    op: 'upsert',
    data: {
      id: row.id as string,
      item_id: row.item_id as never,
      equipped: row.equipped as boolean,
      purchased_at: iso(row.purchased_at),
      ...server(row),
    },
  };
}

export function dayClosureChange(row: Row): ServerChange {
  return {
    table: 'day_closures',
    op: 'upsert',
    data: {
      local_date: row.local_date as string,
      closed_at: iso(row.closed_at),
      hp_lost: row.hp_lost as number,
      missed: row.missed as never,
      ...server(row),
    },
  };
}

/** A hero that doesn't exist yet reads as game-core's brand-new hero. */
export function characterOf(row: Row | undefined): Character {
  if (!row) {
    const hero = newHero();
    return {
      level: hero.level,
      xp_in_level: hero.xpInLevel,
      hp: hero.hp,
      gold: hero.gold,
      current_streak: 0,
      longest_streak: 0,
      last_closed_date: null,
    };
  }
  return {
    level: row.level as number,
    xp_in_level: row.xp_in_level as number,
    hp: row.hp as number,
    gold: row.gold as number,
    current_streak: row.current_streak as number,
    longest_streak: row.longest_streak as number,
    last_closed_date: row.last_closed_date as string | null,
  };
}
