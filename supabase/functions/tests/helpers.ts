// Helpers for tests that call the running Edge Functions on the local Supabase stack. The
// stack's URLs and local default keys come from `supabase status -o env` (pnpm functions:test).

import postgres from 'postgres';

const env = (name: string) => Deno.env.get(name) ?? '';

export const API_URL = env('API_URL');
/** Integration tests are skipped when the local stack isn't running. */
export const NO_STACK = API_URL === '';

const SERVICE_KEY = env('SERVICE_ROLE_KEY');
const ANON_KEY = env('ANON_KEY');

export function database() {
  return postgres(env('DB_URL'), { prepare: false, max: 1, onnotice: () => {} });
}

export interface TestUser {
  id: string;
  token: string;
}

/** A confirmed user with a fresh session; deleting it later removes all of its rows. */
export async function newUser(): Promise<TestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const admin = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const created = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const { id } = await created.json();
  const session = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = await session.json();
  return { id, token: access_token };
}

export async function deleteUser(user: TestUser): Promise<void> {
  const res = await fetch(`${API_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  await res.body?.cancel();
}

export async function callSync(token: string | null, body: unknown, method = 'POST') {
  const res = await fetch(`${API_URL}/functions/v1/sync`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

export const DEVICE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
export const AT = '2026-10-23T14:00:00Z';

export const request = (cursor: number, changes: unknown[] = []) => ({
  device_id: DEVICE,
  cursor,
  app_version: '0.1.0',
  changes,
});

export const profileChange = (heroName: string, timezone = 'America/Toronto') => ({
  table: 'profiles',
  op: 'upsert',
  id: 'me',
  client_updated_at: AT,
  data: { hero_name: heroName, class: 'mage', timezone },
});
