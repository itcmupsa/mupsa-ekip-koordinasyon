-- 1) Activation watermark
create table if not exists public.system_configs (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.system_configs enable row level security;
revoke all on table public.system_configs from public, anon, authenticated;

insert into public.system_configs (key, value)
values ('scheduler_activation', to_jsonb(now()))
on conflict (key) do nothing;

-- 2) Update event_process_members SKS write permission matrix
create or replace function public.can_manage_event_process(target_event_id uuid, target_process_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or (
      target_process_type = 'sks' and exists (
        select 1 from public.events e
        join public.periods per on per.id = e.period_id
        join public.period_memberships pm on pm.period_id = e.period_id
        join public.profiles p on p.id = pm.profile_id
        left join public.event_coordinators ec on ec.event_id = e.id and ec.profile_id = auth.uid()
        left join public.coordinator_roles cr on cr.id = pm.coordinator_role_id
        where e.id = target_event_id
          and pm.profile_id = auth.uid()
          and per.is_active = true
          and pm.is_active = true
          and p.is_active = true
          and (
            e.owner_id = auth.uid() 
            or ec.profile_id is not null
            or cr.slug = 'general-secretary'
          )
      )
    )
    or (
      target_process_type <> 'sks' and (
        public.can_manage_event(target_event_id)
        or exists (
          select 1
          from public.event_process_members epm
          where epm.event_id = target_event_id
            and epm.process_type = target_process_type
            and epm.profile_id = auth.uid()
            and epm.responsibility_type = 'owner'
        )
      )
    );
$$;

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_manager boolean;
  is_sks_manager boolean;
  is_design_owner boolean;
  is_press_owner boolean;
  allowed_fields text[] := array['updated_at'];
begin
  if public.is_super_admin() then
    return new;
  end if;

  is_event_manager := public.can_manage_event(old.id);
  is_sks_manager := public.can_manage_event_process(old.id, 'sks');
  
  is_design_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'design'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );
  is_press_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'press'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );

  if is_event_manager then
    allowed_fields := allowed_fields || array[
      'title', 'description', 'event_status', 'planning_date', 'estimated_date',
      'preparation_start_date', 'confirmed_date', 'venue', 'next_action',
      'general_note', 'report_status'
    ];
  end if;
  if is_sks_manager then allowed_fields := allowed_fields || array['sks_status']; end if;
  if is_design_owner then allowed_fields := allowed_fields || array['design_announcement_status']; end if;
  if is_press_owner then allowed_fields := allowed_fields || array['announcement_status']; end if;
  if public.can_access_event_budget() then
    allowed_fields := allowed_fields || array[
      'budget_status', 'estimated_budget', 'approved_budget', 'actual_expense', 'budget_note'
    ];
  end if;

  if not (is_event_manager or is_sks_manager or is_design_owner or is_press_owner or public.can_access_event_budget()) then
    raise exception 'Bu etkinliği düzenleme yetkiniz yok.';
  end if;
  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Kullanıcı rolünüz bu alanlardan bazılarını değiştirme yetkisine sahip değil.';
  end if;
  if is_event_manager
    and new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayı olmadan etkinlik tamamlanmış olarak işaretlenemez.';
  end if;
  return new;
end;
$$;

-- 2.5) Update RLS policy for events
drop policy if exists "authorized members update events" on public.events;
create policy "authorized members update events"
  on public.events for update
  using (
    public.is_active_member()
    and (
      public.can_manage_event(id)
      or public.can_access_event_budget()
      or public.can_manage_event_process(id, 'sks')
      or exists (
        select 1 from public.event_process_members member
        where member.event_id = id
          and member.process_type in ('design', 'press')
          and member.profile_id = auth.uid()
          and member.responsibility_type = 'owner'
      )
    )
  )
  with check (public.is_active_member());
-- 3) Update notification types
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in (
  'task_assigned', 'task_updated', 'task_due_soon', 'task_overdue',
  'sks_status_changed', 'event_date_changed', 'event_member_added',
  'report_missing', 'link_missing', 'event_completed', 'dependency_activated',
  'dependency_review_required', 'admin_announcement', 'calendar_entry_reminder',
  'awareness_ai_suggestion', 'pr_due', 'pr_followup', 'event_delayed', 'awareness_delayed'
));

-- 4) Reminders function
create or replace function public.queue_pr_and_delay_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  activation_time timestamptz;
begin
  select (value#>>'{}')::timestamptz into activation_time
  from public.system_configs where key = 'scheduler_activation';
  if activation_time is null then return; end if;

  -- A) PR Due Notifications
  insert into public.notifications (
    recipient_id, notification_type, channel, delivery_status, title, body,
    metadata, dedupe_key, scheduled_for
  )
  select
    pm.profile_id,
    'pr_due',
    'in_app',
    'queued',
    'MUPİ hatırlatıyor · PR Paylaşım Zamanı',
    'Planlanan an geldi: ' || pr.title,
    jsonb_build_object(
      'type', 'pr_calendar',
      'pr_entry_id', pr.id,
      'target_url', '/app/takvimler/pr?entry=' || pr.id::text
    ),
    'pr_due_' || pr.id::text || '_' || pm.profile_id::text || '_' || extract(epoch from ((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul'))::bigint::text,
    now()
  from public.pr_calendar_entries pr
  join public.periods p on p.id = pr.period_id
  join public.period_memberships pm on pm.period_id = pr.period_id
  join public.profiles prof on prof.id = pm.profile_id
  where pr.deleted_at is null
    and pr.scheduled_time is not null
    and pr.status not in ('completed', 'cancelled')
    and p.is_active = true
    and pm.is_active = true
    and prof.is_active = true
    and ((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul') >= activation_time
    and ((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul') <= now()
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  -- B) PR Follow-up Notifications (24h after)
  insert into public.notifications (
    recipient_id, notification_type, channel, delivery_status, title, body,
    metadata, dedupe_key, scheduled_for
  )
  select
    pm.profile_id,
    'pr_followup',
    'in_app',
    'queued',
    'MUPİ hatırlatıyor · Paylaşım Durumu',
    'Paylaşım hâlâ planlandı görünüyor. Bir problem mi oldu, yardımcı olayım mı? (' || pr.title || ')',
    jsonb_build_object(
      'type', 'pr_calendar',
      'pr_entry_id', pr.id,
      'target_url', '/app/takvimler/pr?entry=' || pr.id::text
    ),
    'pr_followup_' || pr.id::text || '_' || pm.profile_id::text || '_' || extract(epoch from ((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul'))::bigint::text,
    now()
  from public.pr_calendar_entries pr
  join public.periods p on p.id = pr.period_id
  join public.pr_calendar_permissions perm on perm.period_id = pr.period_id
  join public.period_memberships pm on pm.profile_id = perm.profile_id and pm.period_id = perm.period_id
  join public.profiles prof on prof.id = pm.profile_id
  where pr.deleted_at is null
    and pr.scheduled_time is not null
    and pr.status = 'planned'
    and p.is_active = true
    and pm.is_active = true
    and prof.is_active = true
    and perm.can_manage = true
    and (((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul') + interval '24 hours') >= activation_time
    and (((pr.scheduled_date + pr.scheduled_time) at time zone 'Europe/Istanbul') + interval '24 hours') <= now()
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  -- C) Event Delay
  insert into public.notifications (
    recipient_id, notification_type, channel, delivery_status, title, body,
    metadata, dedupe_key, scheduled_for
  )
  select
    recipient.profile_id,
    'event_delayed',
    'in_app',
    'queued',
    'MUPİ hatırlatıyor · Etkinlik Gecikmesi',
    'Etkinlik tarihi geçti ancak durum hâlâ güncellenmedi: ' || e.title,
    jsonb_build_object(
      'type', 'event',
      'event_id', e.id,
      'target_url', '/app/etkinlikler/' || e.id::text
    ),
    'event_delayed_' || e.id::text || '_' || recipient.profile_id::text || '_' || extract(epoch from coalesce(e.confirmed_date, e.estimated_date))::text,
    now()
  from public.events e
  join public.periods p on p.id = e.period_id
  join (
    select id as event_id, owner_id as profile_id from public.events
    union
    select event_id, profile_id from public.event_coordinators
  ) recipient on recipient.event_id = e.id
  join public.period_memberships pm on pm.profile_id = recipient.profile_id and pm.period_id = e.period_id
  join public.profiles prof on prof.id = pm.profile_id
  where e.deleted_at is null
    and p.is_active = true
    and e.event_status not in ('completed', 'reported', 'archived', 'cancelled')
    and pm.is_active = true
    and prof.is_active = true
    and coalesce(e.confirmed_date, e.estimated_date) is not null
    and ((coalesce(e.confirmed_date, e.estimated_date) + 1 + time '09:00:00') at time zone 'Europe/Istanbul') >= activation_time
    and ((coalesce(e.confirmed_date, e.estimated_date) + 1 + time '09:00:00') at time zone 'Europe/Istanbul') <= now()
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  -- D) Awareness Delay
  insert into public.notifications (
    recipient_id, notification_type, channel, delivery_status, title, body,
    metadata, dedupe_key, scheduled_for
  )
  select
    prof.id,
    'awareness_delayed',
    'in_app',
    'queued',
    'MUPİ hatırlatıyor · Farkındalık Gecikmesi',
    'Farkındalık paylaşım tarihi geçti ancak henüz paylaşılmadı: ' || aw.awareness_name,
    jsonb_build_object(
      'type', 'awareness',
      'awareness_post_id', aw.id,
      'target_url', '/app/farkindalik?record=' || aw.id::text
    ),
    'awareness_delayed_' || aw.id::text || '_' || prof.id::text || '_' || extract(epoch from aw.share_date)::text,
    now()
  from public.awareness_posts aw
  join public.periods p on p.id = aw.period_id
  join public.period_memberships pm on pm.profile_id = aw.press_publication_responsible_id and pm.period_id = aw.period_id
  join public.profiles prof on prof.id = pm.profile_id
  where aw.deleted_at is null
    and p.is_active = true
    and aw.sharing_status <> 'shared'
    and aw.press_publication_responsible_id is not null
    and pm.is_active = true
    and prof.is_active = true
    and aw.share_date is not null
    and ((aw.share_date + 1 + time '09:00:00') at time zone 'Europe/Istanbul') >= activation_time
    and ((aw.share_date + 1 + time '09:00:00') at time zone 'Europe/Istanbul') <= now()
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke execute on function public.queue_pr_and_delay_reminders() from public, anon, authenticated;

-- 5) Schedule the function (every minute)
select cron.schedule(
  'queue_pr_and_delay_reminders',
  '* * * * *',
  $$select public.queue_pr_and_delay_reminders()$$
);
