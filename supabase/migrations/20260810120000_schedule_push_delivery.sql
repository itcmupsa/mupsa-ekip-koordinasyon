-- Kuyruktaki push bildirimlerini guvenli Edge Function'a periyodik olarak teslim eder.
-- Dispatch secret migration'a yazilmaz; Supabase Vault'tan okunur.
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'deliver-push-notifications-every-minute';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'deliver-push-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ykcpiihjcvpotvqmzecb.supabase.co/functions/v1/deliver-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'push_dispatch_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
