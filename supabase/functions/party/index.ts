// The `party` Edge Function (SCOPE.md sections 9.1 and 9.2; D57): create, join and leave a
// party, or read its snapshot. Online only. The platform checks the user's JWT and
// withSupabase checks it again; the user id comes only from the token.

import { withSupabase } from '@supabase/server';
import postgres from 'postgres';

import { partyRequestSchema, type PartyRequest } from '../_shared/shared/index.ts';
import { PartyRefusedError, claimReward, createParty, joinParty, leaveParty } from './actions.ts';
import { countCall } from './rate-limit.ts';
import { partyState } from './state.ts';

const dbUrl = Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw new Error('SUPABASE_DB_URL is not set');
// The service connection bypasses RLS; every query is scoped to the token's user and party.
const sql = postgres(dbUrl, { prepare: false, max: 1 });

const error = (status: number, message: string) => Response.json({ error: message }, { status });

async function run(userId: string, request: PartyRequest) {
  // Counted in its own transaction, so refused attempts count too.
  if (request.action !== 'state') {
    await sql.begin(async (tx) => {
      await countCall(tx, userId);
    });
  }
  return await sql.begin(async (tx) => {
    const [{ now }] = await tx`select now() as now`;
    if (request.action === 'create') await createParty(tx, userId, request.name, now as Date);
    if (request.action === 'join') await joinParty(tx, userId, request.code);
    if (request.action === 'leave') await leaveParty(tx, userId);
    if (request.action === 'claim_reward') await claimReward(tx, userId, request.boss_week_id);
    return await partyState(tx, userId, now as Date);
  });
}

async function handle(req: Request, userId: string): Promise<Response> {
  if (req.method !== 'POST') return error(405, 'Use POST');
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error(400, 'Not JSON');
  }
  const parsed = partyRequestSchema.safeParse(json);
  // Only paths and codes are returned, never the values sent.
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`);
    return Response.json({ error: 'Invalid request', issues }, { status: 400 });
  }
  try {
    return Response.json(await run(userId, parsed.data));
  } catch (e: unknown) {
    if (e instanceof PartyRefusedError) return error(e.status, e.code);
    console.error('party failed', e instanceof Error ? e.message : e);
    return error(500, 'Party action failed');
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) return error(401, 'Sign in first');
    return await handle(req, userId);
  }),
};
