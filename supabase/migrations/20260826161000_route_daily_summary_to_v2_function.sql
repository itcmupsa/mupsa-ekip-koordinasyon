-- Gunluk 09:00 MUPI job'unu yeni, izole v2 Edge Function'a yonlendirir.

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'mupsa-daily-ai-summary-0900-tr';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'mupsa-daily-ai-summary-0900-tr',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://ykcpiihjcvpotvqmzecb.supabase.co/functions/v1/mupi-daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'push_dispatch_secret'
      )
    ),
    body := jsonb_build_object('target_profile_id', membership.profile_id)
  )
  from public.period_memberships membership
  join public.periods period
    on period.id = membership.period_id
   and period.is_active
  join public.profiles profile
    on profile.id = membership.profile_id
   and profile.is_active
  join public.ai_feature_settings setting
    on setting.period_id = membership.period_id
   and setting.is_enabled
   and setting.free_tier_only
  where membership.is_active;
  $$
);
