-- Günlük ortak özeti 3.7 Flash ile dönem başına günde yalnızca bir kez üretir.

update public.ai_feature_settings settings
set flash_model = 'gemini-3.7-flash',
    flash_lite_model = 'gemini-3.5-flash-lite',
    daily_flash_request_cap = 20,
    daily_flash_lite_request_cap = 100,
    policy_version = '2026-08-daily-flash-briefing-v5',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active
  and settings.free_tier_only;

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
  operation_used integer;
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
    join public.profiles profile
      on profile.id = membership.profile_id
     and profile.is_active
    join public.periods period
      on period.id = membership.period_id
     and period.is_active
    where membership.period_id = target_period_id
      and membership.profile_id = target_requester_id
      and membership.is_active
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'inactive_requester');
  end if;

  if target_operation_type in (
    'home_summary',
    'page_analysis',
    'deep_analysis',
    'calendar_deep_analysis',
    'weekly_management_analysis',
    'institutional_memory'
  ) then
    if target_model_id <> setting.flash_model then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_model');
    end if;
    project_cap := setting.daily_flash_request_cap;
  elsif target_operation_type in (
    'chat',
    'draft',
    'calendar_classification',
    'awareness_suggestion'
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

  select coalesce(sum(usage.request_count), 0)::integer
  into project_used
  from public.ai_usage_daily usage
  where usage.period_id = target_period_id
    and usage.usage_date = current_date
    and usage.model_id = target_model_id;

  if project_used >= project_cap then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'project_daily_cap',
      'remaining', 0
    );
  end if;

  if target_operation_type = 'home_summary' then
    select coalesce(sum(usage.request_count), 0)::integer
    into operation_used
    from public.ai_usage_daily usage
    where usage.period_id = target_period_id
      and usage.usage_date = current_date
      and usage.operation_type = 'home_summary'
      and usage.model_id = target_model_id;

    if operation_used >= 1 then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'home_summary_daily_cap',
        'remaining', greatest(project_cap - project_used, 0)
      );
    end if;
  end if;

  if user_cap is not null then
    if target_requester_id is null then
      return jsonb_build_object('allowed', false, 'reason', 'requester_required');
    end if;

    select coalesce(sum(usage.request_count), 0)::integer
    into user_used
    from public.ai_usage_daily usage
    where usage.period_id = target_period_id
      and usage.usage_date = current_date
      and usage.requester_id = target_requester_id
      and usage.operation_type = target_operation_type;

    if user_used >= user_cap then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'user_daily_cap',
        'remaining', 0
      );
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
      period_id,
      usage_date,
      requester_id,
      operation_type,
      model_id,
      request_count
    ) values (
      target_period_id,
      current_date,
      target_requester_id,
      target_operation_type,
      target_model_id,
      1
    )
    returning id into usage_record_id;
  else
    update public.ai_usage_daily
    set request_count = request_count + 1,
        updated_at = now()
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
  'Günlük özeti dönem başına bir kez, diğer AI işlerini model ve uygulama kotasına göre atomik rezerve eder.';

-- Lite politikası altında üretilmiş günlük çıktı saklanır ancak 3.7 politikasında yeniden kullanılmaz.
update public.ai_outputs output
set is_current = false
from public.periods period
where period.id = output.period_id
  and period.is_active
  and output.output_type = 'home_summary'
  and output.is_current;
