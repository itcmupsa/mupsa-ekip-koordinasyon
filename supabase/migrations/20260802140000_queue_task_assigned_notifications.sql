-- Faz 1 / Bildirim motoru - Parca 1
-- Yeni bir gorev atamasinda, atanan kisi icin uygulama ici ve e-posta
-- teslimat kuyruguna ayri kayitlar olusturur. E-posta bu trigger tarafindan
-- gonderilmez; teslimat katmani kuyruktaki kayitlari daha sonra isler.

create or replace function public.queue_task_assigned_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_event_id uuid;
  current_event_title text;
  current_task_title text;
  assignment_label text;
begin
  select t.event_id, e.title, t.title
    into current_event_id, current_event_title, current_task_title
  from public.tasks t
  join public.events e on e.id = t.event_id
  where t.id = new.task_id;

  if not found then
    raise exception 'Bildirim icin gorev veya etkinlik bulunamadi.';
  end if;

  assignment_label := case new.assignment_type
    when 'primary' then 'asıl sorumlu'
    when 'supporting' then 'destekleyen kişi'
    when 'informed' then 'bilgilendirilecek kişi'
  end;

  insert into public.notifications (
    recipient_id,
    event_id,
    task_id,
    notification_type,
    channel,
    title,
    body,
    metadata,
    dedupe_key
  )
  select
    new.profile_id,
    current_event_id,
    new.task_id,
    'task_assigned',
    notification_channel.channel,
    'Yeni görev ataması',
    format(
      '“%s” etkinliğindeki “%s” görevi için %s olarak atandınız.',
      current_event_title,
      current_task_title,
      assignment_label
    ),
    jsonb_build_object(
      'assignment_id', new.id,
      'assignment_type', new.assignment_type,
      'assigned_by', new.assigned_by
    ),
    format('task-assigned:%s:%s', new.id, notification_channel.channel)
  from (values ('in_app'), ('email')) as notification_channel(channel)
  on conflict do nothing;

  return new;
end;
$$;

create trigger queue_task_assigned_notifications
after insert on public.task_assignees
for each row execute function public.queue_task_assigned_notifications();
