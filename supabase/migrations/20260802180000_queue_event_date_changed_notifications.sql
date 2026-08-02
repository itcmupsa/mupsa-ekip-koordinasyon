-- Faz 1 / Bildirim motoru - Parca 4
-- Etkinligin planlama, tahmini, hazirlik baslangici veya kesin tarihi degisince
-- yalnizca o etkinlikle ilgisi olan aktif kullanicilara bildirim uretir.
-- Tarih degisikligi gorev tarihlerini otomatik kaydirmaz.

create or replace function public.queue_event_date_changed_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_dates jsonb;
  changed_date_labels text;
begin
  changed_dates :=
    (case when old.planning_date is distinct from new.planning_date then
      jsonb_build_object('planning_date', jsonb_build_object('previous', old.planning_date, 'current', new.planning_date))
    else '{}'::jsonb end)
    ||
    (case when old.estimated_date is distinct from new.estimated_date then
      jsonb_build_object('estimated_date', jsonb_build_object('previous', old.estimated_date, 'current', new.estimated_date))
    else '{}'::jsonb end)
    ||
    (case when old.preparation_start_date is distinct from new.preparation_start_date then
      jsonb_build_object('preparation_start_date', jsonb_build_object('previous', old.preparation_start_date, 'current', new.preparation_start_date))
    else '{}'::jsonb end)
    ||
    (case when old.confirmed_date is distinct from new.confirmed_date then
      jsonb_build_object('confirmed_date', jsonb_build_object('previous', old.confirmed_date, 'current', new.confirmed_date))
    else '{}'::jsonb end);

  changed_date_labels := concat_ws(', ',
    case when old.planning_date is distinct from new.planning_date then 'planlama tarihi' end,
    case when old.estimated_date is distinct from new.estimated_date then 'tahmini tarih' end,
    case when old.preparation_start_date is distinct from new.preparation_start_date then 'hazirlik baslangici' end,
    case when old.confirmed_date is distinct from new.confirmed_date then 'kesin tarih' end
  );

  with recipients as (
    select new.owner_id as profile_id
    union
    select member.profile_id
    from public.event_members member
    where member.event_id = new.id
    union
    select process_member.profile_id
    from public.event_process_members process_member
    where process_member.event_id = new.id
    union
    select assignee.profile_id
    from public.tasks task
    join public.task_assignees assignee on assignee.task_id = task.id
    where task.event_id = new.id
      and task.deleted_at is null
  ), active_recipients as (
    select recipient.profile_id
    from recipients recipient
    join public.profiles profile on profile.id = recipient.profile_id
      and profile.is_active
    join public.period_memberships membership on membership.profile_id = recipient.profile_id
      and membership.period_id = new.period_id
      and membership.is_active
  )
  insert into public.notifications (
    recipient_id,
    event_id,
    notification_type,
    channel,
    title,
    body,
    metadata,
    dedupe_key
  )
  select
    recipient.profile_id,
    new.id,
    'event_date_changed',
    notification_channel.channel,
    'Etkinlik tarihi güncellendi',
    format('“%s” etkinliğinde %s değişti. İlgili görev ve planlarını gözden geçir.', new.title, changed_date_labels),
    jsonb_build_object(
      'changed_dates', changed_dates,
      'changed_by', auth.uid()
    ),
    format(
      'event-date-changed:%s:%s:%s:%s',
      new.id,
      new.updated_at,
      recipient.profile_id,
      notification_channel.channel
    )
  from active_recipients recipient
  cross join (values ('in_app'), ('email')) as notification_channel(channel);

  return new;
end;
$$;

create trigger queue_event_date_changed_notifications
after update of planning_date, estimated_date, preparation_start_date, confirmed_date on public.events
for each row
when (
  old.planning_date is distinct from new.planning_date
  or old.estimated_date is distinct from new.estimated_date
  or old.preparation_start_date is distinct from new.preparation_start_date
  or old.confirmed_date is distinct from new.confirmed_date
)
execute function public.queue_event_date_changed_notifications();
