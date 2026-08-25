-- İki ayrı ücretsiz Google projesindeki 3.7 Flash havuzunu uygulama
-- seviyesinde birlikte korur. Gerçek sağlayıcı kotası yine Google tarafından
-- proje başına uygulanır.
update public.ai_feature_settings settings
set daily_flash_request_cap = 40,
    policy_version = '2026-08-two-project-flash-debounced-v6',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active
  and settings.free_tier_only;

create or replace function public.queue_ai_home_summary_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_period_id uuid;
  target_source_id uuid;
  target_source_type text := tg_table_name;
  target_dedupe_key text;
begin
  if tg_op = 'DELETE' then
    target_period_id := old.period_id;
    target_source_id := old.id;
  else
    target_period_id := new.period_id;
    target_source_id := new.id;
  end if;

  if target_period_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Tüm ilgili değişiklikler dönem başına tek işte birleştirilir. Yeni bir
  -- değişiklik olursa bekleme süresi son değişiklikten itibaren tekrar 30 dk olur.
  perform pg_advisory_xact_lock(hashtext('ai-home-refresh:' || target_period_id::text));
  target_dedupe_key := 'home-summary-refresh:' || target_period_id::text;

  insert into public.ai_jobs (
    period_id,
    job_type,
    status,
    source_type,
    source_id,
    payload,
    dedupe_key,
    priority,
    available_at
  ) values (
    target_period_id,
    'generate_home_summary',
    'queued',
    target_source_type,
    target_source_id,
    jsonb_build_object(
      'reason', 'source_changed',
      'source_table', target_source_type,
      'queued_at', now()
    ),
    target_dedupe_key,
    70,
    now() + interval '30 minutes'
  )
  on conflict (dedupe_key) do update
  set status = 'queued',
      source_type = excluded.source_type,
      source_id = excluded.source_id,
      payload = excluded.payload,
      priority = excluded.priority,
      available_at = excluded.available_at,
      attempt_count = 0,
      started_at = null,
      completed_at = null,
      error_code = null,
      error_summary = null,
      updated_at = now();

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists events_queue_ai_home_refresh on public.events;
create trigger events_queue_ai_home_refresh
after insert or update or delete on public.events
for each row execute function public.queue_ai_home_summary_refresh();

drop trigger if exists tasks_queue_ai_home_refresh on public.tasks;
create trigger tasks_queue_ai_home_refresh
after insert or update or delete on public.tasks
for each row execute function public.queue_ai_home_summary_refresh();

drop trigger if exists awareness_queue_ai_home_refresh on public.awareness_posts;
create trigger awareness_queue_ai_home_refresh
after insert or update or delete on public.awareness_posts
for each row execute function public.queue_ai_home_summary_refresh();

drop trigger if exists calendar_entries_queue_ai_home_refresh on public.calendar_entries;
create trigger calendar_entries_queue_ai_home_refresh
after insert or update or delete on public.calendar_entries
for each row execute function public.queue_ai_home_summary_refresh();

-- Edge Function her önbellek okumasından önce bu işlemi çağırır. Süresi dolan
-- tek iş varsa mevcut ortak özeti geçersiz kılar; yeni Google isteği ancak bir
-- Süper Yönetici ana sayfayı açtığında yapılır.
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
    and output.is_current;

  update public.ai_jobs
  set status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = due_job_id;

  return true;
end;
$$;

revoke all on function public.queue_ai_home_summary_refresh() from public;
revoke all on function public.apply_due_ai_home_summary_refresh(uuid) from public;
revoke all on function public.apply_due_ai_home_summary_refresh(uuid) from authenticated;
grant execute on function public.apply_due_ai_home_summary_refresh(uuid) to service_role;

-- Önceki sürümdeki dönem başına günlük tek özet kilidini kaldırır; toplam
-- 3.7 Flash kullanımı yukarıdaki 40 çağrılık uygulama kotasıyla korunur.
create or replace function public.reserve_ai_quota(
  target_period_id uuid,
  target_requester_id uuid,
  target_operation_type text,
  target_model_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  setting public.ai_feature_settings%rowtype;
  project_cap integer;
  user_cap integer;
  project_used integer;
  user_used integer;
  usage_record_id uuid;
begin
  select * into setting
  from public.ai_feature_settings ai_setting
  where ai_setting.period_id = target_period_id;

  if setting.period_id is null or not setting.is_enabled or not setting.free_tier_only then
    return jsonb_build_object('allowed', false, 'reason', 'feature_disabled');
  end if;

  if target_requester_id is not null and not exists (
    select 1
    from public.period_memberships membership
    join public.profiles profile on profile.id = membership.profile_id and profile.is_active
    join public.periods period on period.id = membership.period_id and period.is_active
    where membership.period_id = target_period_id
      and membership.profile_id = target_requester_id
      and membership.is_active
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'inactive_requester');
  end if;

  if target_operation_type in (
    'home_summary', 'page_analysis', 'deep_analysis',
    'calendar_deep_analysis', 'weekly_management_analysis', 'institutional_memory'
  ) then
    if target_model_id <> setting.flash_model then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_model');
    end if;
    project_cap := setting.daily_flash_request_cap;
  elsif target_operation_type in (
    'chat', 'draft', 'calendar_classification', 'awareness_suggestion'
  ) then
    if target_model_id <> setting.flash_lite_model then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_model');
    end if;
    project_cap := setting.daily_flash_lite_request_cap;
  elsif target_operation_type = 'embedding' then
    if target_model_id <> setting.embedding_model then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_model');
    end if;
    project_cap := setting.daily_embedding_request_cap;
  else
    return jsonb_build_object('allowed', false, 'reason', 'invalid_operation');
  end if;

  user_cap := case target_operation_type
    when 'chat' then setting.per_user_chat_daily_cap
    when 'draft' then setting.per_user_draft_daily_cap
    else null
  end;

  perform pg_advisory_xact_lock(hashtext(
    target_period_id::text || ':' || current_date::text || ':' || target_model_id
  ));

  select coalesce(sum(usage.request_count), 0)::integer into project_used
  from public.ai_usage_daily usage
  where usage.period_id = target_period_id
    and usage.usage_date = current_date
    and usage.model_id = target_model_id;

  if project_used >= project_cap then
    return jsonb_build_object('allowed', false, 'reason', 'project_daily_cap', 'remaining', 0);
  end if;

  if user_cap is not null then
    if target_requester_id is null then
      return jsonb_build_object('allowed', false, 'reason', 'requester_required');
    end if;
    select coalesce(sum(usage.request_count), 0)::integer into user_used
    from public.ai_usage_daily usage
    where usage.period_id = target_period_id
      and usage.usage_date = current_date
      and usage.requester_id = target_requester_id
      and usage.operation_type = target_operation_type;
    if user_used >= user_cap then
      return jsonb_build_object('allowed', false, 'reason', 'user_daily_cap', 'remaining', 0);
    end if;
  end if;

  select usage.id into usage_record_id
  from public.ai_usage_daily usage
  where usage.period_id = target_period_id
    and usage.usage_date = current_date
    and usage.requester_id is not distinct from target_requester_id
    and usage.operation_type = target_operation_type
    and usage.model_id = target_model_id
  for update;

  if usage_record_id is null then
    insert into public.ai_usage_daily (
      period_id, usage_date, requester_id, operation_type, model_id, request_count
    ) values (
      target_period_id, current_date, target_requester_id, target_operation_type, target_model_id, 1
    ) returning id into usage_record_id;
  else
    update public.ai_usage_daily
    set request_count = request_count + 1, updated_at = now()
    where id = usage_record_id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'usage_id', usage_record_id,
    'remaining', greatest(project_cap - project_used - 1, 0),
    'user_remaining', case
      when user_cap is null then null
      else greatest(user_cap - coalesce(user_used, 0) - 1, 0)
    end
  );
end;
$$;

revoke all on function public.reserve_ai_quota(uuid, uuid, text, text) from public;
revoke all on function public.reserve_ai_quota(uuid, uuid, text, text) from authenticated;
grant execute on function public.reserve_ai_quota(uuid, uuid, text, text) to service_role;

comment on function public.reserve_ai_quota(uuid, uuid, text, text) is
  'İki ayrı ücretsiz Google projesi için 40 Flash çağrısını, Lite ve kullanıcı kotalarını atomik korur.';
