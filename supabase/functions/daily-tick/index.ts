// The `daily-tick` Edge Function (SCOPE.md sections 9.1 and 9.3). pg_cron calls it every hour.
// No player calls it, so there is no user JWT to check (verify_jwt is off in config.toml);
// instead the caller must send the CRON_SECRET, which lives only in the function's secrets and
// the database's Vault (DECISIONS.md D40).

import postgres from 'postgres';

import { runTick } from './tick.ts';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const cronSecret = requireEnv('CRON_SECRET');
const sql = postgres(requireEnv('SUPABASE_DB_URL'), { prepare: false, max: 1 });

const error = (status: number, message: string) => Response.json({ error: message }, { status });

const digest = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

/** Compares hashes byte by byte, so the time taken says nothing about the secret. */
async function isCronSecret(given: string | null): Promise<boolean> {
  if (!given) return false;
  const [a, b] = await Promise.all([digest(given), digest(cronSecret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') return error(405, 'Use POST');
    if (!(await isCronSecret(req.headers.get('x-cron-secret')))) return error(401, 'Not allowed');
    try {
      return Response.json(await runTick(sql));
    } catch (e: unknown) {
      console.error('daily-tick failed', e instanceof Error ? e.message : e);
      return error(500, 'Tick failed');
    }
  },
};
