-- Mevcut uygulama ici bildirim kuyrugundan push teslimat kuyrugu olusturulur.
-- Push gonderimi istemciden degil, yetkili Edge Function tarafindan yapilir.
create or replace function public.queue_push_notification_for_in_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel <> 'in_app' then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    event_id,
    task_id,
    notification_type,
    channel,
    delivery_status,
    title,
    body,
    metadata,
    dedupe_key,
    scheduled_for
  )
  values (
    new.recipient_id,
    new.event_id,
    new.task_id,
    new.notification_type,
    'push',
    'queued',
    new.title,
    new.body,
    new.metadata,
    coalesce(new.dedupe_key, format('notification:%s:in_app', new.id)) || ':push',
    new.scheduled_for
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger queue_push_notification_for_in_app
after insert on public.notifications
for each row execute function public.queue_push_notification_for_in_app();
