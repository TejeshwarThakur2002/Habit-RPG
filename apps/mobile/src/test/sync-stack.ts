// Talking to the local Supabase stack from Node, for the end-to-end sync tests (D45, D53). The
// stack's URL and local default keys come from `supabase status -o env`, written by
// `pnpm sync:test`. The app's own transport (src/lib/supabase.ts) needs React Native, so these
// tests send requests with fetch, the same as supabase-js does.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  partyStateSchema,
  syncRefusalSchema,
  type PartyRequest,
  type PartyState,
  type SyncRequest,
} from '@habit-rpg/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SyncTransport, TransportResult } from '../sync/engine';

const ENV_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  '.temp',
  'functions-test.env',
);

function env(): Record<'API_URL' | 'ANON_KEY' | 'SERVICE_ROLE_KEY', string> {
  // A missing stack is a broken setup here, never a reason to skip (as in CI's Deno tests).
  // Read directly: Jest gives each test file its own copy of process.env.
  const lines = readFileSync(ENV_FILE, 'utf8').split('\n');
  const values = new Map(
    lines
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  const read = (name: string) => {
    const value = values.get(name)?.replace(/^"|"$/g, '');
    if (!value) throw new Error(`${name} is missing from ${ENV_FILE}; run pnpm sync:test`);
    return value;
  };
  return {
    API_URL: read('API_URL'),
    ANON_KEY: read('ANON_KEY'),
    SERVICE_ROLE_KEY: read('SERVICE_ROLE_KEY'),
  };
}

const stack = env();
const admin = { apikey: stack.SERVICE_ROLE_KEY, Authorization: `Bearer ${stack.SERVICE_ROLE_KEY}` };

export interface TestAccount {
  id: string;
  token: string;
}

/** A confirmed account with a session, made through the admin API. */
export async function newAccount(): Promise<TestAccount> {
  const email = `two-phones-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const created = await fetch(`${stack.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`Creating a test account failed: ${created.status}`);
  const { id } = (await created.json()) as { id: string };
  const session = await fetch(`${stack.API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: stack.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!session.ok) throw new Error(`Signing the test account in failed: ${session.status}`);
  const { access_token: token } = (await session.json()) as { access_token: string };
  return { id, token };
}

/** Deleting the login removes every row of the account (D43). */
export async function deleteAccount(account: TestAccount): Promise<void> {
  const res = await fetch(`${stack.API_URL}/auth/v1/admin/users/${account.id}`, {
    method: 'DELETE',
    headers: admin,
  });
  await res.body?.cancel();
}

/** The `sync` function over HTTP, answering like the app's transport (D46, D49). */
export function httpTransport(account: TestAccount): SyncTransport {
  return {
    async send(request: SyncRequest): Promise<TransportResult> {
      let res: Response;
      try {
        res = await fetch(`${stack.API_URL}/functions/v1/sync`, {
          method: 'POST',
          headers: {
            apikey: stack.ANON_KEY,
            Authorization: `Bearer ${account.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });
      } catch {
        return { ok: false, kind: 'offline', message: "Can't reach the server" };
      }
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) return { ok: true, body };
      if (res.status >= 500) {
        return {
          ok: false,
          kind: 'server',
          status: res.status,
          message: 'The server had a problem',
        };
      }
      const refusal = syncRefusalSchema.safeParse(body);
      return {
        ok: false,
        kind: 'refused',
        status: res.status,
        message: `The server refused the sync (${res.status})`,
        ...(refusal.success ? { code: refusal.data.error } : {}),
        ...(refusal.success && refusal.data.hero ? { hero: refusal.data.hero } : {}),
      };
    },
  };
}

/** One of the account's tables as the server holds it, read with the service key. */
export async function serverRows<T>(table: string, account: TestAccount, select: string) {
  const column = table === 'profiles' ? 'id' : 'user_id';
  const res = await fetch(
    `${stack.API_URL}/rest/v1/${table}?${column}=eq.${account.id}&select=${select}`,
    { headers: admin },
  );
  if (!res.ok) throw new Error(`Reading ${table} failed: ${res.status}`);
  return (await res.json()) as T[];
}

/** One `party` action over HTTP: the snapshot, or the refusal code (D57). */
export async function partyCall(
  account: TestAccount,
  request: PartyRequest,
): Promise<{ state: PartyState } | { error: string }> {
  const res = await fetch(`${stack.API_URL}/functions/v1/party`, {
    method: 'POST',
    headers: {
      apikey: stack.ANON_KEY,
      Authorization: `Bearer ${account.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const body: unknown = await res.json();
  if (res.ok) return { state: partyStateSchema.parse(body) };
  return { error: syncRefusalSchema.parse(body).error };
}

/** Sets a boss's HP with the service key, so a test can reach the victory quickly. */
export async function setBossHp(bossWeekId: string, hp: number): Promise<void> {
  const res = await fetch(`${stack.API_URL}/rest/v1/boss_weeks?id=eq.${bossWeekId}`, {
    method: 'PATCH',
    headers: { ...admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_hp: hp }),
  });
  if (!res.ok) throw new Error(`Setting the boss's HP failed: ${res.status}`);
}

/** A Realtime client signed in as the account, as the app's is (D63). */
export function realtimeClient(account: TestAccount): SupabaseClient {
  const client = createClient(stack.API_URL, stack.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  client.realtime.setAuth(account.token);
  return client;
}
