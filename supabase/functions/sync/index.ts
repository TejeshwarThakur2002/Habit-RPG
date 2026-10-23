// The `sync` Edge Function (SCOPE.md sections 8.3 and 9.1). The platform checks the user's
// JWT (verify_jwt) and withSupabase checks it again; the user id comes only from the token,
// never from the request body.

import { withSupabase } from '@supabase/server';
import postgres from 'postgres';

import { syncRequestSchema } from '../_shared/shared/index.ts';
import { UnsupportedChangeError } from './push.ts';
import { runSync } from './sync.ts';

/** 200 changes fit easily; anything bigger is refused before it is parsed (section 9.6). */
export const MAX_BODY_BYTES = 256 * 1024;

const dbUrl = Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw new Error('SUPABASE_DB_URL is not set');
// The service connection bypasses RLS; every query filters by the token's user id.
const sql = postgres(dbUrl, { prepare: false, max: 1 });

const error = (status: number, message: string) => Response.json({ error: message }, { status });

async function handle(req: Request, userId: string): Promise<Response> {
  if (req.method !== 'POST') return error(405, 'Use POST');
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return error(413, 'Too large');

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return error(400, 'Not JSON');
  }
  const parsed = syncRequestSchema.safeParse(json);
  // Only paths and codes are returned: payloads hold habit names, which are never echoed.
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`);
    return Response.json({ error: 'Invalid request', issues }, { status: 400 });
  }

  try {
    return Response.json(await runSync(sql, userId, parsed.data));
  } catch (e: unknown) {
    if (e instanceof UnsupportedChangeError) return error(501, e.message);
    // Logged without the payload, so no habit name reaches the server logs (section 9.6).
    console.error('sync failed', e instanceof Error ? e.message : e);
    return error(500, 'Sync failed');
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) return error(401, 'Sign in first');
    return await handle(req, userId);
  }),
};
