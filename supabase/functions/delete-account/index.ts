// The `delete-account` Edge Function (SCOPE.md F10 and sections 9.1 and 9.6). The caller's own
// token says whose account it is, never the body. Deleting the auth user removes every row of
// theirs, because each player table cascades from the account (pgTAP proves it, D32).

import { withSupabase } from '@supabase/server';

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return error(405, 'Use POST');
    const userId = ctx.userClaims?.id;
    if (!userId) return error(401, 'Sign in first');
    const { error: failed } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (failed) {
      console.error('delete-account failed', failed.message);
      return error(500, 'Deleting the account failed');
    }
    return Response.json({ deleted: true });
  }),
};
