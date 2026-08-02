-- Faz 1 / Bildirim motoru - Parca 2
-- SKS durumu degistiginde, etkinligin donemindeki tum aktif ekip uyelerine
-- uygulama ici ve e-posta teslimat kuyrugu kaydi olusturur.

create or replace function public.queue_sks_status_changed_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_status_label text;
  current_status_label text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select label into previous_status_label
  from public.sks_statuses
  where slug = old.sks_status;

  select label into current_status_label
  from public.sks_statuses
  where slug = new.sks_status;

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
    membership.profile_id,
    new.id,
    'sks_status_changed',
    notification_channel.channel,
    'SKS durumu güncellendi',
    format(
      '“%s” etkinliğinin SKS durumu “%s” iken “%s” oldu.',
      new.title,
      coalesce(previous_status_label, 'Belirlenmedi'),
      coalesce(current_status_label, 'Belirlenmedi')
    ),
    jsonb_build_object(
      'previous_sks_status', old.sks_status,
      'current_sks_status', new.sks_status,
      'changed_by', auth.uid()
    ),
    format(
      'sks-status-changed:%s:%s:%s:%s:%s:%s',
      new.id,
      coalesce(old.sks_status, 'unset'),
      coalesce(new.sks_status, 'unset'),
      new.updated_at,
      membership.profile_id,
      notification_channel.channel
    )
  from public.period_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  cross join (values ('in_app'), ('email')) as notification_channel(channel)
  where membership.period_id = new.period_id
    and membership.is_active
    and profile.is_active;

  return new;
end;
$$;

create trigger queue_sks_status_changed_notifications
after update of sks_status on public.events
for each row
when (old.sks_status is distinct from new.sks_status)
execute function public.queue_sks_status_changed_notifications();
