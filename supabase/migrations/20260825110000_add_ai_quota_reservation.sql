-- Faz 4 / Gemini çağrısından önce atomik uygulama kotası rezervasyonu.
-- Bu fonksiyonlar yalnızca sunucu tarafındaki service_role tarafından çağrılır.

alter table public.ai_feature_settings
  add column daily_embedding_request_cap integer not null default 500
    check (daily_embedding_request_cap between 1 and 50000);

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

  if target_operation_type in ('home_summary', 'page_analysis', 'chat', 'draft') then
    if target_model_id <> setting.flash_model then
      return jsonb_build_object('allowed', false, 'reason', 'invalid_model');
    end if;
    project_cap := setting.daily_flash_request_cap;
  elsif target_operation_type in ('calendar_classification', 'awareness_suggestion') then
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

  -- Aynı dönem/gün/model için eş zamanlı isteklerin kotayı birlikte aşmasını engeller.
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

create or replace function public.record_ai_usage_result(
  target_usage_id uuid,
  target_input_token_count bigint,
  target_output_token_count bigint,
  target_succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_input_token_count < 0 or target_output_token_count < 0 then
    raise exception 'Token sayıları negatif olamaz.';
  end if;

  update public.ai_usage_daily
  set input_token_count = input_token_count + target_input_token_count,
      output_token_count = output_token_count + target_output_token_count,
      failure_count = failure_count + case when target_succeeded then 0 else 1 end,
      updated_at = now()
  where id = target_usage_id;

  if not found then
    raise exception 'AI kullanım rezervasyonu bulunamadı.';
  end if;
end;
$$;

revoke all on function public.reserve_ai_quota(uuid, uuid, text, text) from public;
revoke all on function public.reserve_ai_quota(uuid, uuid, text, text) from authenticated;
grant execute on function public.reserve_ai_quota(uuid, uuid, text, text) to service_role;

revoke all on function public.record_ai_usage_result(uuid, bigint, bigint, boolean) from public;
revoke all on function public.record_ai_usage_result(uuid, bigint, bigint, boolean) from authenticated;
grant execute on function public.record_ai_usage_result(uuid, bigint, bigint, boolean) to service_role;

comment on function public.reserve_ai_quota(uuid, uuid, text, text) is
  'Gemini isteğinden önce proje ve kullanıcı uygulama kotasını atomik olarak rezerve eder.';
