-- Ayni kullanici + ayni gun icin eszamanli iki istegin Gemini'ye birlikte
-- ulasmasini engeller. Mevcut ai_jobs tablosu generation guard olarak kullanilir.

create or replace function public.reserve_mupi_daily_generation(
  target_period_id uuid,
  target_recipient_id uuid,
  target_summary_date date,
  target_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  guard_key text;
  existing_job public.ai_jobs%rowtype;
  job_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu islem yalnizca sunucu tarafindan calistirilabilir.';
  end if;

  guard_key := 'mupi-daily-v2:'
    || target_period_id::text || ':'
    || target_recipient_id::text || ':'
    || target_summary_date::text;

  perform pg_advisory_xact_lock(hashtext(guard_key));

  if not target_force and exists (
    select 1
    from public.ai_outputs output
    where output.period_id = target_period_id
      and output.recipient_id = target_recipient_id
      and output.output_type = 'home_summary'
      and output.summary_date = target_summary_date
      and output.validation_status = 'valid'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'already_generated');
  end if;

  select * into existing_job
  from public.ai_jobs job
  where job.dedupe_key = guard_key
  for update;

  -- Force cache'i asabilir ama halen devam eden ayni gun uretimini asamaz.
  if existing_job.id is not null
    and existing_job.status = 'running'
    and existing_job.updated_at > now() - interval '2 minutes'
  then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'generation_in_progress',
      'job_id', existing_job.id
    );
  end if;

  if existing_job.id is null then
    insert into public.ai_jobs (
      period_id,
      job_type,
      status,
      requested_by,
      payload,
      dedupe_key,
      priority,
      attempt_count,
      started_at,
      available_at
    ) values (
      target_period_id,
      'generate_home_summary',
      'running',
      target_recipient_id,
      jsonb_build_object(
        'schema_version', 'mupi-daily-summary-v2',
        'recipient_id', target_recipient_id,
        'summary_date', target_summary_date
      ),
      guard_key,
      80,
      1,
      now(),
      now()
    )
    returning id into job_id;
  else
    update public.ai_jobs
    set status = 'running',
        requested_by = target_recipient_id,
        payload = jsonb_build_object(
          'schema_version', 'mupi-daily-summary-v2',
          'recipient_id', target_recipient_id,
          'summary_date', target_summary_date
        ),
        attempt_count = attempt_count + 1,
        started_at = now(),
        completed_at = null,
        error_code = null,
        error_summary = null,
        updated_at = now()
    where id = existing_job.id
    returning id into job_id;
  end if;

  return jsonb_build_object('allowed', true, 'job_id', job_id);
end;
$$;

create or replace function public.complete_mupi_daily_generation(
  target_job_id uuid,
  target_succeeded boolean,
  target_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu islem yalnizca sunucu tarafindan calistirilabilir.';
  end if;

  update public.ai_jobs
  set status = case when target_succeeded then 'completed' else 'failed' end,
      completed_at = now(),
      error_code = case when target_succeeded then null else left(coalesce(target_error_code, 'mupi_generation_failed'), 120) end,
      updated_at = now()
  where id = target_job_id
    and job_type = 'generate_home_summary';
end;
$$;

revoke all on function public.reserve_mupi_daily_generation(uuid, uuid, date, boolean) from public;
revoke all on function public.reserve_mupi_daily_generation(uuid, uuid, date, boolean) from authenticated;
grant execute on function public.reserve_mupi_daily_generation(uuid, uuid, date, boolean) to service_role;

revoke all on function public.complete_mupi_daily_generation(uuid, boolean, text) from public;
revoke all on function public.complete_mupi_daily_generation(uuid, boolean, text) from authenticated;
grant execute on function public.complete_mupi_daily_generation(uuid, boolean, text) to service_role;
