-- Merkezi görevlerin geciken ve yaklaşan son tarih bildirimlerini de almasını sağlar.

create or replace function public.queue_task_overdue_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with overdue_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, task.period_id,
      coalesce(event_record.title, awareness.awareness_name, 'Bağımsız görev') as context_title
    from public.tasks task
    left join public.events event_record on event_record.id = task.event_id
    left join public.awareness_posts awareness on awareness.id = task.awareness_post_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and (event_record.id is null or event_record.deleted_at is null)
      and (awareness.id is null or awareness.deleted_at is null)
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
      and membership.is_active and membership.app_role = 'super_admin'
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id and membership.is_active
    join public.coordinator_roles role on role.id = membership.coordinator_role_id
    where role.slug = 'president'
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join overdue_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id and membership.is_active
  )
  insert into public.notifications (recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key)
  select recipient.profile_id, task.event_id, task.id, 'task_overdue', notification_channel.channel,
    'Görev gecikti',
    format('“%s” bağlamındaki “%s” görevinin son tarihi geçti.', task.context_title, task.title),
    jsonb_build_object('reminder_stage', 'initial', 'deadline_at', task.deadline_at),
    format('task-overdue:initial:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from overdue_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;

  with overdue_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, task.period_id,
      coalesce(event_record.title, awareness.awareness_name, 'Bağımsız görev') as context_title
    from public.tasks task
    left join public.events event_record on event_record.id = task.event_id
    left join public.awareness_posts awareness on awareness.id = task.awareness_post_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and (event_record.id is null or event_record.deleted_at is null)
      and (awareness.id is null or awareness.deleted_at is null)
      and task.deadline_at is not null
      and task.deadline_at <= now()
  ), recipients as (
    select task.id as task_id, event_record.owner_id as profile_id
    from overdue_tasks task join public.events event_record on event_record.id = task.event_id
    union
    select task.id, assignee.profile_id
    from overdue_tasks task join public.task_assignees assignee on assignee.task_id = task.id
    where assignee.assignment_type in ('primary', 'supporting')
    union
    select task.id, membership.profile_id
    from overdue_tasks task join public.period_memberships membership on membership.period_id = task.period_id
      and membership.is_active and membership.app_role = 'super_admin'
    union
    select task.id, membership.profile_id
    from overdue_tasks task
    join public.period_memberships membership on membership.period_id = task.period_id and membership.is_active
    join public.coordinator_roles role on role.id = membership.coordinator_role_id
    where role.slug = 'president'
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join overdue_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id and membership.is_active
  )
  insert into public.notifications (recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key)
  select recipient.profile_id, task.event_id, task.id, 'task_overdue', notification_channel.channel,
    'Görev halen gecikmiş durumda',
    format('“%s” bağlamındaki “%s” görevi 24 saattir gecikmiş durumda.', task.context_title, task.title),
    jsonb_build_object('reminder_stage', '24_hour_reminder', 'deadline_at', task.deadline_at),
    format('task-overdue:reminder:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from overdue_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  where exists (
    select 1 from public.notifications initial_notification
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
  with due_soon_tasks as (
    select task.id, task.event_id, task.title, task.deadline_at, task.period_id,
      coalesce(event_record.title, awareness.awareness_name, 'Bağımsız görev') as context_title
    from public.tasks task
    left join public.events event_record on event_record.id = task.event_id
    left join public.awareness_posts awareness on awareness.id = task.awareness_post_id
    where task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and (event_record.id is null or event_record.deleted_at is null)
      and (awareness.id is null or awareness.deleted_at is null)
      and task.deadline_at > now()
      and task.deadline_at <= now() + interval '24 hours'
  ), recipients as (
    select task.id as task_id, event_record.owner_id as profile_id
    from due_soon_tasks task join public.events event_record on event_record.id = task.event_id
    union
    select task.id, assignee.profile_id
    from due_soon_tasks task join public.task_assignees assignee on assignee.task_id = task.id
    where assignee.assignment_type in ('primary', 'supporting')
  ), active_recipients as (
    select recipient.task_id, recipient.profile_id
    from recipients recipient
    join due_soon_tasks task on task.id = recipient.task_id
    join public.profiles profile on profile.id = recipient.profile_id and profile.is_active
    join public.period_memberships membership on membership.period_id = task.period_id
      and membership.profile_id = recipient.profile_id and membership.is_active
  )
  insert into public.notifications (recipient_id, event_id, task_id, notification_type, channel, title, body, metadata, dedupe_key)
  select recipient.profile_id, task.event_id, task.id, 'task_due_soon', notification_channel.channel,
    'Görevin son tarihi yaklaşıyor',
    format('“%s” bağlamındaki “%s” görevinin son tarihi sonraki 24 saat içinde.', task.context_title, task.title),
    jsonb_build_object('window_hours', 24, 'deadline_at', task.deadline_at),
    format('task-due-soon:%s:%s:%s:%s', task.id, task.deadline_at, recipient.profile_id, notification_channel.channel)
  from due_soon_tasks task
  join active_recipients recipient on recipient.task_id = task.id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;
end;
$$;

