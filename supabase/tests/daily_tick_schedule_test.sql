-- The hourly call to daily-tick (SCOPE.md section 9.3, DECISIONS.md D41). pg_net only sends a
-- queued request once the transaction commits, so this rolled-back test sends nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select schedule from cron.job where jobname = 'daily-tick'), '0 * * * *',
  'daily-tick runs at minute 0 of every hour'
);
select is(
  (select command from cron.job where jobname = 'daily-tick'), 'select private.call_daily_tick()',
  'the job calls private.call_daily_tick'
);
select ok(
  not has_function_privilege('anon', 'private.call_daily_tick()', 'execute')
    and not has_function_privilege('authenticated', 'private.call_daily_tick()', 'execute'),
  'players can''t call it'
);

-- Without both Vault values (a fresh or not-yet-set-up project) nothing is sent.
delete from vault.secrets where name in ('project_url', 'cron_secret');
select vault.create_secret('http://gateway.test', 'project_url');
select is(private.call_daily_tick(), null, 'without the secret it sends nothing');

select vault.create_secret('test-secret', 'cron_secret');
create temporary table queued as select private.call_daily_tick() as id;
select isnt((select id from queued), null, 'with both values it queues a request');
select results_eq(
  $$select method::text, url, headers->>'x-cron-secret' from net.http_request_queue
    where id = (select id from queued)$$,
  $$values ('POST', 'http://gateway.test/functions/v1/daily-tick', 'test-secret')$$,
  'it POSTs to daily-tick with the cron secret'
);

select * from finish();
rollback;
