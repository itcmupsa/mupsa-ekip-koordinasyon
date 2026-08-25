-- Ortak kulüp AI özetini her gün 09:00 Türkiye saatiyle üretir.
-- pg_cron UTC kullanır: 06:00 UTC = 09:00 Europe/Istanbul.
-- İstek, repoya gizli anahtar yazmadan mevcut Supabase Vault sırrıyla imzalanır.

create extension if not exists pg_net with schema extensions;

create or replace function public.get_ai_home_context_for_member(
  target_period_id uuid,
  target_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu işlem yalnızca sunucu tarafından çalıştırılabilir.';
  end if;
  if not exists (
    select 1
    from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id and profile.is_active
    join public.periods period on period.id = membership.period_id and period.is_active
    where membership.period_id = target_period_id
      and membership.profile_id = target_profile_id
      and membership.is_active
      and membership.app_role = 'super_admin'
  ) then
    raise exception 'Aktif Süper Yönetici üyeliği bulunamadı.';
  end if;

  perform set_config('request.jwt.claim.sub', target_profile_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_profile_id, 'role', 'authenticated')::text,
    true
  );
  result := public.get_my_ai_home_context(target_period_id);
  return result;
end;
$$;

create or replace function public.get_ai_home_activity_for_member(
  target_period_id uuid,
  target_profile_id uuid,
  target_changed_since timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu işlem yalnızca sunucu tarafından çalıştırılabilir.';
  end if;
  if not exists (
    select 1
    from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id and profile.is_active
    join public.periods period on period.id = membership.period_id and period.is_active
    where membership.period_id = target_period_id
      and membership.profile_id = target_profile_id
      and membership.is_active
      and membership.app_role = 'super_admin'
  ) then
    raise exception 'Aktif Süper Yönetici üyeliği bulunamadı.';
  end if;

  perform set_config('request.jwt.claim.sub', target_profile_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_profile_id, 'role', 'authenticated')::text,
    true
  );
  result := public.get_my_ai_home_activity(target_period_id, target_changed_since);
  return result;
end;
$$;

revoke all on function public.get_ai_home_context_for_member(uuid, uuid) from public;
revoke all on function public.get_ai_home_context_for_member(uuid, uuid) from authenticated;
grant execute on function public.get_ai_home_context_for_member(uuid, uuid) to service_role;

revoke all on function public.get_ai_home_activity_for_member(uuid, uuid, timestamptz) from public;
revoke all on function public.get_ai_home_activity_for_member(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.get_ai_home_activity_for_member(uuid, uuid, timestamptz) to service_role;

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
    url := 'https://ykcpiihjcvpotvqmzecb.supabase.co/functions/v1/ai-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'push_dispatch_secret'
      )
    ),
    body := '{"operation":"scheduled_daily_summary"}'::jsonb
  );
  $$
);

-- Migration uygulanınca ilk özeti de hemen kuyruğa gönderir.
select net.http_post(
  url := 'https://ykcpiihjcvpotvqmzecb.supabase.co/functions/v1/ai-orchestrator',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-dispatch-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'push_dispatch_secret'
    )
  ),
  body := '{"operation":"scheduled_daily_summary"}'::jsonb
);

