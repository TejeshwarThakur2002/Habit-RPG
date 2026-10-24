// @ts-check
// Gives the local Edge Functions a CRON_SECRET (DECISIONS.md D40). `supabase functions serve`
// loads supabase/functions/.env, and the Deno tests read the same file to call daily-tick.
// The value is random per machine and the file is ignored by git; a hosted project gets its
// own with `supabase secrets set`.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const file = join(import.meta.dirname, '../supabase/functions/.env');
const current = existsSync(file) ? readFileSync(file, 'utf8') : '';

// Left alone when present: rewriting it would restart a running `functions serve`.
if (!/^CRON_SECRET=.+$/m.test(current)) {
  const line = `CRON_SECRET=${randomBytes(32).toString('hex')}\n`;
  writeFileSync(file, current && !current.endsWith('\n') ? `${current}\n${line}` : current + line);
  console.log('Wrote a local CRON_SECRET to supabase/functions/.env');
}
