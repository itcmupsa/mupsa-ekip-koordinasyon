-- Faz 4 / AI temel altyapısı.
-- Bu migration Gemini çağrısı yapmaz ve hiçbir AI özelliğini kullanıcıya açmaz.
-- Yeni dönem ayarları varsayılan olarak kapalıdır.

create extension if not exists vector with schema extensions;

create table public.ai_feature_settings (
  period_id uuid primary key references public.periods(id) on delete cascade,
  is_enabled boolean not null default false,
  free_tier_only boolean not null default true check (free_tier_only),
  flash_model text not null default 'gemini-2.5-flash',
  flash_lite_model text not null default 'gemini-2.5-flash-lite',
  embedding_model text not null default 'gemini-embedding-001',
  daily_flash_request_cap integer not null default 120 check (daily_flash_request_cap between 1 and 10000),
  daily_flash_lite_request_cap integer not null default 600 check (daily_flash_lite_request_cap between 1 and 50000),
  per_user_chat_daily_cap integer not null default 10 check (per_user_chat_daily_cap between 0 and 100),
  per_user_draft_daily_cap integer not null default 5 check (per_user_draft_daily_cap between 0 and 100),
  report_reminder_offset_days integer check (report_reminder_offset_days between 0 and 90),
  policy_version text not null default '2026-08-v1',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_source_approvals (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'event_report', 'event_decision', 'handover_note',
    'event_description', 'awareness_content'
  )),
  entity_id uuid not null,
  classification text not null default 'confidential' check (classification in (
    'public', 'approved_internal', 'confidential'
  )),
  is_ai_allowed boolean not null default false,
  approval_note text check (approval_note is null or char_length(approval_note) <= 500),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, entity_type, entity_id),
  check (
    (is_ai_allowed = false)
    or (
      classification in ('public', 'approved_internal')
      and approved_by is not null
      and approved_at is not null
    )
  ),
  check (classification <> 'confidential' or is_ai_allowed = false)
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  job_type text not null check (job_type in (
    'embed_source', 'generate_home_summary', 'generate_page_analysis',
    'generate_draft', 'classify_calendar_entry', 'scan_awareness_dates'
  )),
  status text not null default 'queued' check (status in (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  )),
  source_type text,
  source_id uuid,
  requested_by uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  priority smallint not null default 50 check (priority between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_summary text check (error_summary is null or char_length(error_summary) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_id is null or source_type is not null)
);

create index ai_jobs_claim_idx
  on public.ai_jobs(status, available_at, priority desc, created_at)
  where status in ('queued', 'failed');

create table public.ai_context_chunks (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  approval_id uuid references public.ai_source_approvals(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  chunk_key text not null,
  content_classification text not null check (content_classification in (
    'public', 'approved_internal'
  )),
  access_policy text not null check (access_policy in (
    'active_members', 'entity_authorized', 'super_admin',
    'treasurer', 'public_relations'
  )),
  content_text text not null check (char_length(trim(content_text)) > 0),
  content_hash text not null check (char_length(content_hash) = 64),
  metadata jsonb not null default '{}'::jsonb,
  embedding_model text not null default 'gemini-embedding-001',
  embedding extensions.vector(768),
  source_updated_at timestamptz,
  embedded_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, entity_type, entity_id, chunk_key, content_hash),
  check (embedding is null or embedded_at is not null),
  check (approval_id is not null)
);

create index ai_context_chunks_source_idx
  on public.ai_context_chunks(period_id, entity_type, entity_id, is_active);

create table public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  usage_date date not null default current_date,
  requester_id uuid references public.profiles(id) on delete set null,
  operation_type text not null,
  model_id text not null,
  request_count integer not null default 0 check (request_count >= 0),
  input_token_count bigint not null default 0 check (input_token_count >= 0),
  output_token_count bigint not null default 0 check (output_token_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  updated_at timestamptz not null default now()
);

create unique index ai_usage_daily_scope_unique
  on public.ai_usage_daily(
    period_id,
    usage_date,
    coalesce(requester_id, '00000000-0000-0000-0000-000000000000'::uuid),
    operation_type,
    model_id
  );

create index ai_usage_daily_period_date_idx
  on public.ai_usage_daily(period_id, usage_date);

create table public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  output_type text not null check (output_type in (
    'home_summary', 'page_analysis', 'awareness_suggestion',
    'calendar_classification', 'draft'
  )),
  context_entity_type text,
  context_entity_id uuid,
  payload jsonb not null,
  source_manifest jsonb not null default '[]'::jsonb,
  context_hash text not null check (char_length(context_hash) = 64),
  model_id text not null,
  validation_status text not null default 'pending' check (validation_status in (
    'pending', 'valid', 'partial', 'invalid'
  )),
  validation_errors jsonb not null default '[]'::jsonb,
  is_current boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (context_entity_id is null or context_entity_type is not null)
);

create or replace function public.stamp_ai_feature_setting_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.stamp_ai_source_approval_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.is_ai_allowed then
      new.approved_by := auth.uid();
      new.approved_at := now();
    else
      new.approved_by := null;
      new.approved_at := null;
    end if;
  end if;
  return new;
end;
$$;

create index ai_outputs_recipient_current_idx
  on public.ai_outputs(recipient_id, output_type, is_current, created_at desc);

create unique index ai_outputs_one_current_context
  on public.ai_outputs(
    period_id,
    recipient_id,
    output_type,
    coalesce(context_entity_type, ''),
    coalesce(context_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_current;

drop trigger if exists ai_feature_settings_set_updated_at on public.ai_feature_settings;
create trigger ai_feature_settings_set_updated_at
before update on public.ai_feature_settings
for each row execute function public.set_updated_at();

drop trigger if exists ai_feature_settings_stamp_actor on public.ai_feature_settings;
create trigger ai_feature_settings_stamp_actor
before insert or update on public.ai_feature_settings
for each row execute function public.stamp_ai_feature_setting_actor();

drop trigger if exists ai_source_approvals_set_updated_at on public.ai_source_approvals;
create trigger ai_source_approvals_set_updated_at
before update on public.ai_source_approvals
for each row execute function public.set_updated_at();

drop trigger if exists ai_source_approvals_stamp_actor on public.ai_source_approvals;
create trigger ai_source_approvals_stamp_actor
before insert or update on public.ai_source_approvals
for each row execute function public.stamp_ai_source_approval_actor();

drop trigger if exists ai_jobs_set_updated_at on public.ai_jobs;
create trigger ai_jobs_set_updated_at
before update on public.ai_jobs
for each row execute function public.set_updated_at();

drop trigger if exists ai_context_chunks_set_updated_at on public.ai_context_chunks;
create trigger ai_context_chunks_set_updated_at
before update on public.ai_context_chunks
for each row execute function public.set_updated_at();

alter table public.ai_feature_settings enable row level security;
alter table public.ai_source_approvals enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_context_chunks enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_outputs enable row level security;

create policy "super admins read ai settings"
on public.ai_feature_settings for select
using (public.is_super_admin());

create policy "super admins manage ai settings"
on public.ai_feature_settings for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super admins read ai source approvals"
on public.ai_source_approvals for select
using (public.is_super_admin());

create policy "super admins manage ai source approvals"
on public.ai_source_approvals for all
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "super admins read ai jobs"
on public.ai_jobs for select
using (public.is_super_admin());

-- ai_context_chunks istemciden doğrudan okunmaz. RLS açık ve kullanıcı politikası yoktur.

create policy "members read own ai usage"
on public.ai_usage_daily for select
using (requester_id = auth.uid() or public.is_super_admin());

create policy "members read own ai outputs"
on public.ai_outputs for select
using (recipient_id = auth.uid());

create or replace function public.is_ai_enabled(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ai_feature_settings setting
    join public.periods period
      on period.id = setting.period_id
     and period.is_active
    join public.period_memberships membership
      on membership.period_id = setting.period_id
     and membership.profile_id = auth.uid()
     and membership.is_active
    join public.profiles profile
      on profile.id = membership.profile_id
     and profile.is_active
    where setting.period_id = target_period_id
      and setting.is_enabled
      and setting.free_tier_only
  );
$$;

revoke all on function public.is_ai_enabled(uuid) from public;
grant execute on function public.is_ai_enabled(uuid) to authenticated;

-- Mevcut aktif dönem için kapalı varsayılan ayarı oluştur. Kullanıcıya AI göstermez.
insert into public.ai_feature_settings (period_id)
select period.id
from public.periods period
where period.is_active
on conflict (period_id) do nothing;
