-- MUPI v2 gecis korumasi.
-- Not: Dosya adi tarihsel olarak "protect_and_seed" olarak kalir; ilk gun seed'i
-- artik yalnizca tum bagimliliklar olustuktan sonra 20260826167000 migration'inda
-- calistirilir. Boylece generation guard RPC'si hazir olmadan HTTP istegi atilmaz.

create or replace function public.protect_current_mupi_daily_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.output_type = 'home_summary'
    and old.is_current
    and new.is_current = false
    and old.summary_date = (now() at time zone 'Europe/Istanbul')::date
    and old.payload ->> 'schema_version' = 'mupi-daily-summary-v2'
  then
    new.is_current := true;
  end if;
  return new;
end;
$$;

drop trigger if exists ai_outputs_protect_current_mupi_daily_v2 on public.ai_outputs;
create trigger ai_outputs_protect_current_mupi_daily_v2
before update of is_current on public.ai_outputs
for each row execute function public.protect_current_mupi_daily_v2();

-- Eski debounce isi artik v2 kaydini gecersiz kilmaz. Kuyrugu tamamlar;
-- legacy kayitlari pasiflestirebilir.
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

  update public.ai_outputs output
  set is_current = false
  where output.period_id = target_period_id
    and output.output_type = 'home_summary'
    and output.is_current
    and output.summary_date is null;

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
