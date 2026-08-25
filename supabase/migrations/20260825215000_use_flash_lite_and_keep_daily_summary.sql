-- Günlük MUPİ özetini yüksek ücretsiz kotaya sahip Gemini 3.5 Flash Lite'a taşır.
-- Geçerli özet, yenisi başarıyla üretilene kadar görünür kalır.

update public.ai_feature_settings settings
set flash_model = 'gemini-3.5-flash-lite',
    flash_lite_model = 'gemini-3.5-flash-lite',
    daily_flash_request_cap = 100,
    daily_flash_lite_request_cap = 400,
    policy_version = '2026-08-flash-lite-persistent-summary-v7',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active
  and settings.free_tier_only;

create or replace function public.apply_due_ai_home_summary_refresh(target_period_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  due_job_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai-home-refresh:' || target_period_id::text));

  select job.id into due_job_id
  from public.ai_jobs job
  where job.period_id = target_period_id
    and job.job_type = 'generate_home_summary'
    and job.status = 'queued'
    and job.available_at <= now()
  order by job.available_at
  limit 1
  for update;

  if due_job_id is null then return false; end if;

  -- Eski özet burada artık pasifleştirilmez. Edge Function yenisini güvenle
  -- sakladıktan sonra önceki çıktıyı emekliye ayırır.
  update public.ai_jobs
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = due_job_id;

  return true;
end;
$$;

revoke all on function public.apply_due_ai_home_summary_refresh(uuid) from public;
revoke all on function public.apply_due_ai_home_summary_refresh(uuid) from authenticated;
grant execute on function public.apply_due_ai_home_summary_refresh(uuid) to service_role;

create or replace function public.replace_ai_home_output(
  target_period_id uuid,
  target_recipient_id uuid,
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
  new_output_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Bu işlem yalnızca sunucu tarafından çalıştırılabilir.';
  end if;

  perform pg_advisory_xact_lock(hashtext(
    'ai-home-output:' || target_period_id::text || ':' || target_recipient_id::text
  ));

  insert into public.ai_outputs (
    period_id, recipient_id, output_type, payload, source_manifest,
    context_hash, model_id, validation_status, validation_errors,
    is_current, expires_at
  ) values (
    target_period_id, target_recipient_id, 'home_summary', target_payload,
    coalesce(target_source_manifest, '[]'::jsonb), target_context_hash,
    target_model_id, 'valid', '[]'::jsonb, false, target_expires_at
  ) returning id into new_output_id;

  update public.ai_outputs
  set is_current = false
  where period_id = target_period_id
    and recipient_id = target_recipient_id
    and output_type = 'home_summary'
    and is_current;

  update public.ai_outputs
  set is_current = true
  where id = new_output_id;

  return new_output_id;
end;
$$;

revoke all on function public.replace_ai_home_output(uuid, uuid, jsonb, jsonb, text, text, timestamptz) from public;
revoke all on function public.replace_ai_home_output(uuid, uuid, jsonb, jsonb, text, text, timestamptz) from authenticated;
grant execute on function public.replace_ai_home_output(uuid, uuid, jsonb, jsonb, text, text, timestamptz) to service_role;
