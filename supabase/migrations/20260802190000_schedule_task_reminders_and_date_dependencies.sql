-- Faz 1 / Bildirim motoru - Parca 5
-- Zamanlanmis kontroller:
--   1) Geciken aktif gorevleri ilk anda ve 24 saat sonra bir kez hatirlatir.
--   2) Son tarihi sonraki 24 saat icinde olan aktif gorevleri hatirlatir.
--   3) Etkinlik tarihine bagli taslak gorevleri, tum kosullari saglaninca aktife alir.
-- pg_cron zamanlari UTC'dir: 06:00 UTC = Turkiye saatiyle 09:00.

create or replace function public.queue_task_overdue_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ilk gecikme bildirimi: gorev sahibi, asil/destek atananlar,
  -- Baskan ve Super Yoneticiler. Her kisiye uygulama ici + e-posta.
  with overdue_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, event_record.title as event_title, event_record.period_id
    from public.tasks task
    join public.events event_record on event_record.id = task.event_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and event_record.deleted_at is null
      and task.deadline_at is not null
      and task.deadline_at <= now()
  ), recipients as (
    select task.id as task_id, event_record.owner_id as profile_id
    from overdue_tasks task
    join public.events event_record on event_record.id = task.event_id
    union
    select task.id, assignee.profile_id
    from overdue_tasks task
    join public.task_assignees assignee on assignee.task_id = task.id
    where assignee.assignment_type in ('primary', 'supporting')
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.is_active
      and membership.app_role = 'super_admin'
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.is_active
    join public.coordinator_roles role on role.id = membership.coordinator_role_id
    where role.slug = 'president'
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join overdue_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id
      and membership.is_active
  )
  insert into public.notifications (
    recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    recipient.profile_id,
    task.event_id,
    task.id,
    'task_overdue',
    notification_channel.channel,
    'Gorev gecikti',
    format('“%s” etkinligindeki “%s” gorevinin son tarihi gecti.', task.event_title, task.title),
    jsonb_build_object('reminder_stage', 'initial', 'deadline_at', task.deadline_at),
    format('task-overdue:initial:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from overdue_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;

  -- Gorev halen bitmemisse, ilk gecikme bildiriminden en az 24 saat sonra
  -- yalnizca bir kez ikinci hatirlatma gonderilir.
  with overdue_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, event_record.title as event_title, event_record.period_id
    from public.tasks task
    join public.events event_record on event_record.id = task.event_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and event_record.deleted_at is null
      and task.deadline_at is not null
      and task.deadline_at <= now()
  ), recipients as (
    select task.id as task_id, event_record.owner_id as profile_id
    from overdue_tasks task
    join public.events event_record on event_record.id = task.event_id
    union
    select task.id, assignee.profile_id
    from overdue_tasks task
    join public.task_assignees assignee on assignee.task_id = task.id
    where assignee.assignment_type in ('primary', 'supporting')
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.is_active
      and membership.app_role = 'super_admin'
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.is_active
    join public.coordinator_roles role on role.id = membership.coordinator_role_id
    where role.slug = 'president'
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join overdue_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id
      and membership.is_active
  )
  insert into public.notifications (
    recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    recipient.profile_id,
    task.event_id,
    task.id,
    'task_overdue',
    notification_channel.channel,
    'Gorev halen gecikmis durumda',
    format('“%s” etkinligindeki “%s” gorevi 24 saattir gecikmis durumda.', task.event_title, task.title),
    jsonb_build_object('reminder_stage', '24_hour_reminder', 'deadline_at', task.deadline_at),
    format('task-overdue:reminder:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from overdue_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  where exists (
    select 1
    from public.notifications initial_notification
    where initial_notification.task_id = task.id
      and initial_notification.recipient_id = recipient.profile_id
      and initial_notification.channel = notification_channel.channel
      and initial_notification.notification_type = 'task_overdue'
      and initial_notification.metadata ->> 'reminder_stage' = 'initial'
      and initial_notification.created_at <= now() - interval '24 hours'
  )
  on conflict do nothing;
end;
$$;

create or replace function public.queue_task_due_soon_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Varsayilan pencere: sonraki 24 saat. Yaklasan isler yalnizca etkinlik
  -- sahibine ve gorevin asil/destek atananlarina gider; gecikme gibi tum
  -- yoneticileri mesgul etmez.
  with due_soon_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, event_record.title as event_title, event_record.period_id
    from public.tasks task
    join public.events event_record on event_record.id = task.event_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and event_record.deleted_at is null
      and task.deadline_at is not null
      and task.deadline_at > now()
      and task.deadline_at <= now() + interval '24 hours'
  ), recipients as (
    select task.id as task_id, event_record.owner_id as profile_id
    from due_soon_tasks task
    join public.events event_record on event_record.id = task.event_id
    union
    select task.id, assignee.profile_id
    from due_soon_tasks task
    join public.task_assignees assignee on assignee.task_id = task.id
    where assignee.assignment_type in ('primary', 'supporting')
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join due_soon_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id
      and membership.is_active
  )
  insert into public.notifications (
    recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    recipient.profile_id,
    task.event_id,
    task.id,
    'task_due_soon',
    notification_channel.channel,
    'Gorevin son tarihi yaklasiyor',
    format('“%s” etkinligindeki “%s” gorevinin son tarihi sonraki 24 saat icinde.', task.event_title, task.title),
    jsonb_build_object('window_hours', 24, 'deadline_at', task.deadline_at),
    format('task-due-soon:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from due_soon_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;
end;
$$;

create or replace function public.activate_ready_date_dependent_tasks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tarih bagimliligi kesin tarih varsa onu, yoksa uzun vadeli planlamayi
  -- desteklemek icin tahmini tarihi esas alir. offset_days negatifse etkinlikten
  -- onceki gunleri ifade eder (ornegin -14 = 14 gun once).
  with activated_tasks as (
    update public.tasks dependent_task
    set activation_status = 'active'
    where dependent_task.activation_status = 'draft'
      and dependent_task.deleted_at is null
      and exists (
        select 1
        from public.task_dependencies date_dependency
        join public.events source_event on source_event.id = date_dependency.source_event_id
        where date_dependency.task_id = dependent_task.id
          and date_dependency.dependency_type = 'event_date_offset'
          and source_event.deleted_at is null
          and coalesce(source_event.confirmed_date, source_event.estimated_date) is not null
          and coalesce(source_event.confirmed_date, source_event.estimated_date) + date_dependency.offset_days <= current_date
      )
      and not exists (
        select 1
        from public.task_dependencies required_dependency
        where required_dependency.task_id = dependent_task.id
          and not (
            (required_dependency.dependency_type = 'sks_status' and exists (
              select 1
              from public.events source_event
              where source_event.id = required_dependency.source_event_id
                and source_event.deleted_at is null
                and source_event.sks_status = required_dependency.required_sks_status
            ))
            or
            (required_dependency.dependency_type = 'task_progress' and exists (
              select 1
              from public.tasks source_task
              where source_task.id = required_dependency.source_task_id
                and source_task.progress_status = required_dependency.required_task_progress_status
                and source_task.deleted_at is null
            ))
            or
            (required_dependency.dependency_type = 'event_date_offset' and exists (
              select 1
              from public.events source_event
              where source_event.id = required_dependency.source_event_id
                and source_event.deleted_at is null
                and coalesce(source_event.confirmed_date, source_event.estimated_date) is not null
                and coalesce(source_event.confirmed_date, source_event.estimated_date) + required_dependency.offset_days <= current_date
            ))
          )
      )
    returning dependent_task.id, dependent_task.event_id, dependent_task.title, dependent_task.updated_at
  )
  insert into public.notifications (
    recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    assignee.profile_id,
    activated_task.event_id,
    activated_task.id,
    'dependency_activated',
    notification_channel.channel,
    'Bagimli goreviniz aktiflesti',
    format('“%s” etkinligindeki “%s” gorevi artik aktif; sira sizde.', event_record.title, activated_task.title),
    jsonb_build_object(
      'activation_reason', 'event_date_offset_reached',
      'activated_at', activated_task.updated_at
    ),
    format(
      'dependency-activated:%s:%s:%s:%s',
      activated_task.id,
      activated_task.updated_at,
      assignee.profile_id,
      notification_channel.channel
    )
  from activated_tasks activated_task
  join public.events event_record on event_record.id = activated_task.event_id
  join public.task_assignees assignee on assignee.task_id = activated_task.id
  join public.profiles profile on profile.id = assignee.profile_id and profile.is_active
  join public.period_memberships membership on membership.profile_id = assignee.profile_id
    and membership.period_id = event_record.period_id
    and membership.is_active
  cross join (values ('in_app'), ('email')) as notification_channel(channel);
end;
$$;

create or replace function public.run_daily_task_and_date_scan()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.queue_task_due_soon_notifications();
  perform public.activate_ready_date_dependent_tasks();
end;
$$;

-- Gecikme tespiti hizli olmali; ikinci bildirim ise ilk bildirimden 24 saat
-- sonra ve yalnizca bir kez uretilir. Gunluk kontrol 09:00 Turkiye saatindedir.
select cron.schedule(
  'mupsa-task-overdue-scan',
  '*/15 * * * *',
  $cron$select public.queue_task_overdue_notifications();$cron$
);

select cron.schedule(
  'mupsa-daily-task-and-date-scan',
  '0 6 * * *',
  $cron$select public.run_daily_task_and_date_scan();$cron$
);

revoke all on function public.queue_task_overdue_notifications() from public;
revoke all on function public.queue_task_due_soon_notifications() from public;
revoke all on function public.activate_ready_date_dependent_tasks() from public;
revoke all on function public.run_daily_task_and_date_scan() from public;
