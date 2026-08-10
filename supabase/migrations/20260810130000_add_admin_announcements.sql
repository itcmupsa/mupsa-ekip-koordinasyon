-- Süper yöneticilerin etkinlik/görev bağımsız duyuru göndermesini sağlar.
alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check check (notification_type in (
    'task_assigned', 'task_updated', 'task_due_soon', 'task_overdue',
    'sks_status_changed', 'event_date_changed', 'event_member_added',
    'report_missing', 'link_missing', 'event_completed', 'dependency_activated',
    'dependency_review_required', 'admin_announcement'
  ));

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check check (entity_type in (
    'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
    'period_membership', 'event_decision', 'event_report', 'event_link',
    'event_file', 'event_budget_sponsor', 'awareness_post', 'calendar_entry',
    'admin_announcement'
  ));

create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  audience_scope text not null check (audience_scope in ('everyone', 'coordinator_roles', 'profiles')),
  coordinator_role_ids uuid[] not null default '{}'::uuid[],
  profile_ids uuid[] not null default '{}'::uuid[],
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index admin_announcements_period_created_idx
  on public.admin_announcements(period_id, created_at desc);

alter table public.admin_announcements enable row level security;

create policy "super admins read admin announcements"
  on public.admin_announcements for select
  using (public.is_super_admin());

create or replace function public.send_admin_announcement(
  p_title text,
  p_body text,
  p_audience_scope text,
  p_coordinator_role_ids uuid[] default '{}'::uuid[],
  p_profile_ids uuid[] default '{}'::uuid[],
  p_scheduled_for timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_period_id uuid;
  announcement_id uuid;
  scheduled_at timestamptz := coalesce(p_scheduled_for, now());
  recipient_ids uuid[];
  recipient_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'Yalnızca Süper Yöneticiler duyuru gönderebilir.' using errcode = '42501';
  end if;

  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 120 then
    raise exception 'Duyuru başlığı 1-120 karakter arasında olmalıdır.' using errcode = '22023';
  end if;

  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 2000 then
    raise exception 'Duyuru metni 1-2000 karakter arasında olmalıdır.' using errcode = '22023';
  end if;

  if p_audience_scope not in ('everyone', 'coordinator_roles', 'profiles') then
    raise exception 'Geçersiz duyuru alıcı seçimi.' using errcode = '22023';
  end if;

  if p_audience_scope = 'coordinator_roles' and coalesce(cardinality(p_coordinator_role_ids), 0) = 0 then
    raise exception 'En az bir koordinatörlük seçilmelidir.' using errcode = '22023';
  end if;

  if p_audience_scope = 'profiles' and coalesce(cardinality(p_profile_ids), 0) = 0 then
    raise exception 'En az bir kişi seçilmelidir.' using errcode = '22023';
  end if;

  select id into active_period_id
  from public.periods
  where is_active
  order by starts_on desc nulls last, created_at desc
  limit 1;

  if active_period_id is null then
    raise exception 'Aktif dönem bulunamadı.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct membership.profile_id), '{}'::uuid[])
  into recipient_ids
  from public.period_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  where membership.period_id = active_period_id
    and membership.is_active
    and profile.is_active
    and (
      membership.app_role = 'super_admin'
      or p_audience_scope = 'everyone'
      or (p_audience_scope = 'coordinator_roles' and membership.coordinator_role_id = any(p_coordinator_role_ids))
      or (p_audience_scope = 'profiles' and membership.profile_id = any(p_profile_ids))
    );

  recipient_count := coalesce(cardinality(recipient_ids), 0);
  if recipient_count = 0 then
    raise exception 'Duyuru için uygun aktif alıcı bulunamadı.' using errcode = 'P0002';
  end if;

  insert into public.admin_announcements (
    period_id,
    created_by,
    title,
    body,
    audience_scope,
    coordinator_role_ids,
    profile_ids,
    scheduled_for
  )
  values (
    active_period_id,
    auth.uid(),
    trim(p_title),
    trim(p_body),
    p_audience_scope,
    coalesce(p_coordinator_role_ids, '{}'::uuid[]),
    coalesce(p_profile_ids, '{}'::uuid[]),
    scheduled_at
  )
  returning id into announcement_id;

  insert into public.notifications (
    recipient_id,
    notification_type,
    channel,
    delivery_status,
    title,
    body,
    metadata,
    dedupe_key,
    scheduled_for
  )
  select
    recipient_id,
    'admin_announcement',
    'in_app',
    'queued',
    trim(p_title),
    trim(p_body),
    jsonb_build_object('announcement_id', announcement_id, 'audience_scope', p_audience_scope),
    format('admin-announcement:%s:%s:in_app', announcement_id, recipient_id),
    scheduled_at
  from unnest(recipient_ids) as recipients(recipient_id);

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
  values (
    auth.uid(),
    'admin_announcement',
    announcement_id,
    'created',
    jsonb_build_object(
      'title', trim(p_title),
      'audience_scope', p_audience_scope,
      'recipient_count', recipient_count,
      'scheduled_for', scheduled_at
    )
  );

  return jsonb_build_object(
    'announcement_id', announcement_id,
    'recipient_count', recipient_count,
    'scheduled_for', scheduled_at
  );
end;
$$;

revoke all on function public.send_admin_announcement(text, text, text, uuid[], uuid[], timestamptz) from public;
grant execute on function public.send_admin_announcement(text, text, text, uuid[], uuid[], timestamptz) to authenticated;
