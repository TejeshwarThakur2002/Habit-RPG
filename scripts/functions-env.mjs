// @ts-check
// Sets up the local Edge Functions' secret (DECISIONS.md D40, D41). `supabase functions serve`
// loads CRON_SECRET from supabase/functions/.env, the Deno tests read the same file, and the
// local database's Vault gets the same value plus the URL pg_cron calls, so the hourly job can
// reach daily-tick. The value is random per machine and the file is ignored by git; a hosted
// project gets its own with `supabase secrets set` and two Vault entries.

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const envFile = join(root, 'supabase/functions/.env');
// The API gateway as the database container sees it, on Docker's network.
const LOCAL_PROJECT_URL = 'http://api.supabase.internal:8000';

function cronSecret() {
  const current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  const found = /^CRON_SECRET=(.+)$/m.exec(current);
  if (found?.[1]) return found[1];
  // Only written when missing: rewriting it would restart a running `functions serve`.
  const secret = randomBytes(32).toString('hex');
  const line = `CRON_SECRET=${secret}\n`;
  writeFileSync(
    envFile,
    current && !current.endsWith('\n') ? `${current}\n${line}` : current + line,
  );
  console.log('Wrote a local CRON_SECRET to supabase/functions/.env');
  return secret;
}

/**
 * Stores both values in the local Vault, replacing old ones (a `db reset` empties it).
 * @param {string} secret
 */
function storeInVault(secret) {
  /** @type {(name: string, value: string) => string} */
  const upsert = (name, value) => `
    perform vault.update_secret(id, '${value}') from vault.secrets where name = '${name}';
    if not found then perform vault.create_secret('${value}', '${name}'); end if;`;
  const sql = `do $$ begin ${upsert('project_url', LOCAL_PROJECT_URL)} ${upsert('cron_secret', secret)} end $$;`;
  // A file under supabase/.temp (ignored by git), so the secret isn't on a command line.
  const dir = join(root, 'supabase/.temp');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'local-vault.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  try {
    // The project's pinned CLI; an older global one may lack `db query`.
    const cli = join(root, 'node_modules/.bin/supabase');
    execFileSync(cli, ['db', 'query', '--local', '-f', file], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(file, { force: true });
  }
}

storeInVault(cronSecret());
