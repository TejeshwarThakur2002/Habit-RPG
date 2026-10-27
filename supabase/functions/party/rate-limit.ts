// At most 10 party changes a minute per account (SCOPE.md section 9.2; D56, D57): a fixed
// one-minute window counted in `rate_limits`. Reading the snapshot (`state`) isn't counted,
// since the phone asks for it on every Realtime event.

import type { TransactionSql } from 'postgres';

import { PartyRefusedError } from './actions.ts';

export const CALLS_PER_MINUTE = 10;

export async function countCall(sql: TransactionSql, userId: string): Promise<void> {
  const [{ calls }] = await sql`
    insert into public.rate_limits (user_id, window_start, calls)
    values (${userId}, date_trunc('minute', now()), 1)
    on conflict (user_id) do update set
      calls = case when public.rate_limits.window_start = excluded.window_start
        then public.rate_limits.calls + 1 else 1 end,
      window_start = excluded.window_start
    returning calls`;
  if (calls > CALLS_PER_MINUTE) throw new PartyRefusedError(429, 'rate_limited');
}
