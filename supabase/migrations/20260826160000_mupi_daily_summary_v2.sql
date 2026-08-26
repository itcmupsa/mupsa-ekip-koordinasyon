-- MUPI Gunluk Ozet v2
-- 1) Europe/Istanbul gununu kesinlestirir.
-- 2) Mevcut yetki filtreli context'i, yalnizca deterministik motorun ihtiyac duydugu
--    dusuk riskli surec kodlariyla zenginlestirir.
-- 3) Service-role context uretimini tum aktif uyelere acar.
-- 4) Gunluk output idempotency ve atomik upsert ekler.

alter table public.ai_outputs
  add column if not exists summary_date date;

create unique index if not exists ai_outputs_home_summary_daily_unique
  on public.ai_outputs(period_id, recipient_id, output_type, summary_date)
  where output_type = 'home_summary' and summary_date is not null;

create or replace function public.get_my_mupi_daily_context(target_period_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_context jsonb;
  enriched_events jsonb;
  tr_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  base_context := public.get_my_ai_home_context(target_period_id);

  select coalesce(jsonb_agg(
    event_item
    || jsonb_build_object(
      'effective_date', coalesce(event_record.confirmed_date, event_record.estimated_date),
      'days_until_event', coalesce(event_record.confirmed_date, event_record.estimated_date) - tr_today,
      'design_announcement_status', event_record.design_announcement_status,
      'report_status', event_record.report_status
    )
    order by coalesce(event_record.confirmed_date, event_record.estimated_date) nulls last
  ), '[]'::jsonb)
  into enriched_events
  from jsonb_array_elements(coalesce(base_context->'events', '[]'::jsonb)) event_item
  join public.events event_record
    on event_record.id = (event_item->>'source_id')::uuid
   and event_record.period_id = target_period_id
   and event_record.deleted_at is null;

  return base_context
    || jsonb_build_object(
      'schema_version', 'mupi-daily-context-v2',
      'today', tr_today,
      'events', enriched_events,
      'policy', coalesce(base_context->'policy', '{}'::jsonb) || jsonb_build_object(
        'summary_timezone', 'Europe/Istanbul',
        'selection_engine', 'deterministic-v2',
        'max_today_items', 3,
        'max_upcoming_items', 3
      )
    );
end;
$$;

revoke all on function public.get_my_mupi_daily_context(uuid) from public;
grant execute on function public.get_my_mupi_daily_context(uuid) to authenticated;

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
    raise exception 'Bu islem yalnizca sunucu tarafindan calistirilabilir.';
  end if;

  if not exists (
    select 1
    from public.period_memberships membership
    join public.profiles profile
      on profile.id = membership.profile_id
     and profile.is_active
    join public.periods period
      on period.id = membership.period_id
     and period.is_active
    where membership.period_id = target_period_id
      and membership.profile_id = target_profile_id
      and membership.is_active
  ) then
    raise exception 'Aktif uye bulunamadi.';
  end if;

  perform set_config('request.jwt.claim.sub', target_profile_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_profile_id, 'role', 'authenticated')::text,
    true
  );
  result := public.get_my_mupi_daily_context(target_period_id);
  return result;
end;
$$;

revoke all on function public.get_ai_home_context_for_member(uuid, uuid) from public;
revoke all on function public.get_ai_home_context_for_member(uuid, uuid) from authenticated;
grant execute on function public.get_ai_home_context_for_member(uuid, uuid) to service_role;

create or replace function public.replace_mupi_daily_output(
  target_period_id uuid,
  target_recipient_id uuid,
  target_summary_date date,
  target_payload jsonb,
  target_source_manifest jsonb,
  target_context_hash text,
  target_model_id text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  output_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu islem yalnizca sunucu tarafindan calistirilabilir.';
  end if;

  select id into existing_id
  from public.ai_outputs
  where period_id = target_period_id
    and recipient_id = target_recipient_id
    and output_type = 'home_summary'
    and summary_date = target_summary_date
  limit 1
  for update;

  update public.ai_outputs
  set is_current = false
  where period_id = target_period_id
    and recipient_id = target_recipient_id
    and output_type = 'home_summary'
    and is_current
    and (existing_id is null or id <> existing_id);

  if existing_id is not null then
    update public.ai_outputs
    set payload = target_payload,
        source_manifest = target_source_manifest,
        context_hash = target_context_hash,
        model_id = target_model_id,
        validation_status = 'valid',
        validation_errors = '[]'::jsonb,
        is_current = true,
        expires_at = target_expires_at,
        created_at = now()
    where id = existing_id
    returning id into output_id;
  else
    insert into public.ai_outputs (
      period_id, recipient_id, output_type, summary_date,
      payload, source_manifest, context_hash, model_id,
      validation_status, validation_errors, is_current, expires_at
    ) values (
      target_period_id, target_recipient_id, 'home_summary', target_summary_date,
      target_payload, target_source_manifest, target_context_hash, target_model_id,
      'valid', '[]'::jsonb, true, target_expires_at
    )
    returning id into output_id;
  end if;

  return output_id;
end;
$$;

revoke all on function public.replace_mupi_daily_output(uuid, uuid, date, jsonb, jsonb, text, text, timestamptz) from public;
grant execute on function public.replace_mupi_daily_output(uuid, uuid, date, jsonb, jsonb, text, text, timestamptz) to service_role;

-- Her aktif uye icin ayri HTTP isi olusturulur. Bu sayede tek Edge Function istegi
-- tum uyeleri seri halde isleyip timeout riski yaratmaz.
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
    body := jsonb_build_object(
      'operation', 'scheduled_daily_summary',
      'target_profile_id', membership.profile_id
    )
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
