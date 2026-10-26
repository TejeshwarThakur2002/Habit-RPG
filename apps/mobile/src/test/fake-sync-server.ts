import type {
  AccountHero,
  Change,
  ServerChange,
  SyncRequest,
  SyncResponse,
} from '@habit-rpg/shared';

import type { SyncTransport, TransportResult } from '../sync/engine';

const PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const AT = '2026-10-24T15:00:00.000Z';

/** `ok` lets a request through, so a later one in the queue can fail. */
type Failure =
  'ok' | 'offline' | 'server' | 'refused' | 'hero-exists' | 'hero-replaced' | 'lost-reply';

/**
 * An in-memory stand-in for the `sync` Edge Function: it stores what it is sent (idempotent by
 * id), numbers every write with one sequence, and answers pulls by that sequence. It skips the
 * real rules (those are the Deno tests'); it exists to test the phone's engine (D46).
 */
export class FakeSyncServer implements SyncTransport {
  rows = new Map<string, { seq: number; change: ServerChange }>();
  requests: SyncRequest[] = [];
  character: SyncResponse['character'] = {
    level: 1,
    xp_in_level: 12,
    hp: 44,
    gold: 4,
    current_streak: 0,
    longest_streak: 0,
    last_closed_date: null,
  };
  pageSize = 500;
  /** The account's hero as `hero_exists` names it. */
  accountHero: AccountHero = { hero_name: 'Bea', class: 'rogue', level: 3 };
  /** Called with each request before it is answered, e.g. to change the phone mid-sync. */
  onRequest: (request: SyncRequest) => void = () => {};
  reject: (change: Change) => SyncResponse['rejected'][number]['reason'] | null = () => null;
  private failures: Failure[] = [];
  private seq = 0;
  private importing = false;

  failNext(...kinds: Failure[]): void {
    this.failures.push(...kinds);
  }

  /** A row written by another phone. */
  seed(change: ServerChange): void {
    const id = change.op === 'delete' ? change.id : 'id' in change.data ? change.data.id : AT;
    this.rows.set(`${change.table}:${id}`, { seq: ++this.seq, change });
  }

  async send(request: SyncRequest): Promise<TransportResult> {
    this.requests.push(structuredClone(request));
    this.onRequest(request);
    const failure = this.failures.shift();
    if (failure === 'offline') return { ok: false, kind: 'offline', message: 'offline' };
    if (failure === 'server') return { ok: false, kind: 'server', status: 500, message: '500' };
    if (failure === 'refused') return { ok: false, kind: 'refused', status: 409, message: '409' };
    if (failure === 'hero-exists') {
      const hero = this.accountHero;
      return { ok: false, kind: 'refused', status: 409, code: 'hero_exists', hero, message: '409' };
    }
    if (failure === 'hero-replaced') {
      return { ok: false, kind: 'refused', status: 409, code: 'hero_replaced', message: '409' };
    }
    // A replacing import starts by deleting the account's rows, as the real one does (D49).
    if (request.import?.replace && !this.importing) this.rows.clear();
    if (request.import) this.importing = !request.import.done;

    const applied: string[] = [];
    const rejected: SyncResponse['rejected'] = [];
    for (const change of request.changes) {
      const reason = this.reject(change);
      if (reason) rejected.push({ id: change.id, table: change.table, reason });
      else {
        this.store(change);
        applied.push(change.id);
      }
    }
    // The server applied everything, then the answer never arrived.
    if (failure === 'lost-reply') return { ok: false, kind: 'offline', message: 'lost' };

    const newer = [...this.rows.values()]
      .filter((r) => r.seq > request.cursor)
      .sort((a, b) => a.seq - b.seq);
    const page = newer.slice(0, this.pageSize);
    const body: SyncResponse = {
      cursor: page.at(-1)?.seq ?? request.cursor,
      has_more: newer.length > this.pageSize,
      server_time: AT,
      changes: page.map((r) => r.change),
      character: this.character,
      applied,
      rejected,
    };
    return { ok: true, body: structuredClone(body) };
  }

  private store(change: Change): void {
    if (change.op === 'delete') {
      this.rows.delete(`inventory:${change.id}`);
      this.seed({ table: 'inventory', op: 'delete', id: change.id });
      return;
    }
    // Every write takes the next number, as the server's stamp trigger does (D32).
    const seq = ++this.seq;
    const meta = { server_seq: seq, updated_at: AT };
    let row: ServerChange;
    switch (change.table) {
      case 'profiles':
        row = {
          table: 'profiles',
          op: 'upsert',
          data: { id: PROFILE_ID, ...change.data, created_at: AT, ...meta },
        };
        break;
      case 'habits':
        row = {
          table: 'habits',
          op: 'upsert',
          data: {
            id: change.id,
            ...change.data,
            client_updated_at: change.client_updated_at,
            ...meta,
          },
        };
        break;
      case 'completions':
        row = {
          table: 'completions',
          op: 'upsert',
          data: {
            id: change.id,
            ...change.data,
            category: 'mind',
            xp_awarded: 12,
            gold_awarded: 4,
            boss_damage: 12,
            is_late: false,
            ...meta,
          },
        };
        break;
      case 'inventory':
        row = {
          table: 'inventory',
          op: 'upsert',
          data: { id: change.id, ...change.data, ...meta },
        };
        break;
    }
    // Keyed by id, so a retried change replaces itself rather than adding a second row.
    this.rows.set(`${change.table}:${change.id}`, { seq, change: row });
  }

  stored(table: string): ServerChange[] {
    return [...this.rows.entries()]
      .filter(([k]) => k.startsWith(`${table}:`))
      .map(([, r]) => r.change);
  }
}
