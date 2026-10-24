-- Calling the `daily-tick` Edge Function at minute 0 of every hour (SCOPE.md section 9.3,
-- DECISIONS.md D41), with pg_cron and pg_net as Supabase's "Scheduling Edge Functions" guide
-- shows. The project URL and CRON_SECRET are read from Vault at call time, so nothing secret
-- is in this file: each environment stores its own values.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Not exposed through the Data API, so players can't reach anything in it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Queues the POST and returns pg_net's request id, or null when Vault lacks either value (a
-- fresh database, or a hosted project not set up yet), which then only logs a warning rather
-- than failing every hour.
create function private.call_daily_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then
    raise warning 'daily-tick not called: project_url or cron_secret is missing from Vault';
    return null;
  end if;
  return net.http_post(
    url := base_url || '/functions/v1/daily-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb,
    -- pg_net's default is 2 s; a run may take longer, and the function stops at 150 s.
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_daily_tick() from public, anon, authenticated;

select cron.schedule('daily-tick', '0 * * * *', 'select private.call_daily_tick()');
