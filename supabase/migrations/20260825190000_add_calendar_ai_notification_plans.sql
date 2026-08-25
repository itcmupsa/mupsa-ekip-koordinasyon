-- Manuel takvim kayıtlarının AI sınıflandırmasına göre tüm aktif dönem üyelerine
-- planlanan uygulama/PWA bildirimlerini saklar. Alıcı seçimi AI'ya bırakılmaz.

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check check (notification_type in (
    'task_assigned', 'task_updated', 'task_due_soon', 'task_overdue',
    'sks_status_changed', 'event_date_changed', 'event_member_added',
    'report_missing', 'link_missing', 'event_completed', 'dependency_activated',
    'dependency_review_required', 'admin_announcement', 'calendar_entry_reminder'
  ));

create table public.calendar_ai_notification_plans (
  calendar_entry_id uuid primary key references public.calendar_entries(id) on delete cascade,
  period_id uuid not null references public.periods(id) on delete cascade,
  classification text not null check (classification in (
    'club_meeting', 'academic_period', 'exam_period', 'holiday',
    'governance', 'multi_day_program', 'not_global'
  )),
  should_notify boolean not null,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  event_time time,
  model_id text not null,
  source_hash text not null check (char_length(source_hash) = 64),
  scheduled_times jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index calendar_ai_notification_plans_period_idx
  on public.calendar_ai_notification_plans(period_id, should_notify);

alter table public.calendar_ai_notification_plans enable row level security;

create policy "super admins read calendar ai notification plans"
on public.calendar_ai_notification_plans for select
using (public.is_super_admin());

create or replace function public.cancel_calendar_entry_future_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where notification_type = 'calendar_entry_reminder'
    and delivery_status = 'queued'
    and scheduled_for > now()
    and metadata ->> 'calendar_entry_id' = old.id::text;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.deleted_at is not null
     or old.deleted_at is distinct from new.deleted_at
     or old.title is distinct from new.title
     or old.entry_type is distinct from new.entry_type
     or old.start_date is distinct from new.start_date
     or old.end_date is distinct from new.end_date
     or old.note is distinct from new.note then
    delete from public.calendar_ai_notification_plans
    where calendar_entry_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_entries_cancel_future_ai_notifications on public.calendar_entries;
create trigger calendar_entries_cancel_future_ai_notifications
after update or delete on public.calendar_entries
for each row execute function public.cancel_calendar_entry_future_notifications();

-- Kesin tarih ilk kez girildiğinde veya değiştiğinde tüm aktif dönem üyelerini
-- bilgilendir. Tahmini/planlama/hazırlık tarihleri toplu duyuru üretmez.
create or replace function public.queue_event_date_changed_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_title text;
  message_body text;
begin
  if new.confirmed_date is null or old.confirmed_date is not distinct from new.confirmed_date then
    return new;
  end if;

  if old.confirmed_date is null then
    message_title := 'Etkinlik tarihi kesinleşti';
    message_body := format('“%s” etkinliğinin kesin tarihi %s olarak belirlendi.', new.title, to_char(new.confirmed_date, 'DD.MM.YYYY'));
  elsif new.confirmed_date > old.confirmed_date then
    message_title := 'Etkinlik ertelendi';
    message_body := format('“%s” etkinliği %s tarihinden %s tarihine ertelendi.', new.title, to_char(old.confirmed_date, 'DD.MM.YYYY'), to_char(new.confirmed_date, 'DD.MM.YYYY'));
  elsif new.confirmed_date < old.confirmed_date then
    message_title := 'Etkinlik tarihi öne alındı';
    message_body := format('“%s” etkinliği %s tarihinden %s tarihine alındı.', new.title, to_char(old.confirmed_date, 'DD.MM.YYYY'), to_char(new.confirmed_date, 'DD.MM.YYYY'));
  else
    return new;
  end if;

  insert into public.notifications (
    recipient_id, event_id, notification_type, channel, title, body, metadata, dedupe_key
  )
  select
    membership.profile_id,
    new.id,
    'event_date_changed',
    'in_app',
    message_title,
    message_body,
    jsonb_build_object('confirmed_date', new.confirmed_date, 'previous_confirmed_date', old.confirmed_date),
    format('event-confirmed-date:%s:%s:%s', new.id, new.confirmed_date, membership.profile_id)
  from public.period_memberships membership
  join public.profiles profile on profile.id = membership.profile_id and profile.is_active
  where membership.period_id = new.period_id
    and membership.is_active
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists queue_event_date_changed_notifications on public.events;
create trigger queue_event_date_changed_notifications
after update of confirmed_date on public.events
for each row
when (old.confirmed_date is distinct from new.confirmed_date and new.confirmed_date is not null)
execute function public.queue_event_date_changed_notifications();
