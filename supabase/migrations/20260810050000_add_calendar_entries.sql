-- Takvim özelliği: mevcut etkinlik, farkındalık ve görev kayıtlarını tekrar
-- oluşturmadan, manuel takvim kayıtları için ek tablo ve güvenli görev RPC'si.

create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0),
  entry_type text not null check (entry_type in ('academic', 'official', 'meeting', 'other')),
  start_date date not null,
  end_date date,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  check (end_date is null or end_date >= start_date),
  check (deleted_at is null or deleted_by is not null)
);

create index calendar_entries_period_date_idx
  on public.calendar_entries(period_id, start_date, end_date);

alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (
  entity_type in (
    'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
    'period_membership', 'event_decision', 'event_report', 'event_link', 'event_file',
    'event_budget_sponsor', 'awareness_post', 'calendar_entry'
  )
);

drop trigger if exists calendar_entries_set_updated_at on public.calendar_entries;
create trigger calendar_entries_set_updated_at
before update on public.calendar_entries
for each row execute function public.set_updated_at();

create or replace function public.assert_calendar_entry_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_super_admin() and public.is_period_locked(new.period_id) then
    raise exception 'Bu dönem kilitli olduğu için takvim kaydı değiştirilemez.';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_entries_assert_period_unlocked on public.calendar_entries;
create trigger calendar_entries_assert_period_unlocked
before insert or update on public.calendar_entries
for each row execute function public.assert_calendar_entry_period_unlocked();

create or replace function public.enforce_calendar_entry_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.period_id is distinct from old.period_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Takvim kaydının dönemi ve oluşturan kişi değiştirilemez.';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_entries_enforce_write_permissions on public.calendar_entries;
create trigger calendar_entries_enforce_write_permissions
before update on public.calendar_entries
for each row execute function public.enforce_calendar_entry_write_permissions();

drop trigger if exists audit_calendar_entries on public.calendar_entries;
create trigger audit_calendar_entries
after insert or update or delete on public.calendar_entries
for each row execute function public.record_audit_log('calendar_entry');

alter table public.calendar_entries enable row level security;

create policy "active members read calendar entries"
on public.calendar_entries for select
using (
  public.is_active_member()
  and (deleted_at is null or public.is_super_admin())
);

create policy "admins insert calendar entries"
on public.calendar_entries for insert
with check (
  public.is_super_admin()
  and created_by = auth.uid()
);

create policy "admins update calendar entries"
on public.calendar_entries for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- Görev RLS'si mevcut etkinlik detay ekranının ortak görev görünürlüğünü korur.
-- Takvim için özel RPC, kullanıcıyı istemciden gelen profile_id'ye bırakmaz.
create or replace function public.get_my_calendar_task_deadlines(target_period_id uuid)
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  title text,
  deadline_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    task.id,
    task.event_id,
    event_record.title as event_title,
    task.title,
    task.deadline_at
  from public.tasks task
  join public.events event_record on event_record.id = task.event_id
  join public.task_assignees assignee on assignee.task_id = task.id
  where assignee.profile_id = auth.uid()
    and assignee.assignment_type = 'primary'
    and event_record.period_id = target_period_id
    and event_record.deleted_at is null
    and task.activation_status = 'active'
    and task.progress_status not in ('completed', 'cancelled')
    and task.deleted_at is null
    and task.deadline_at is not null
    and exists (
      select 1
      from public.period_memberships membership
      where membership.period_id = target_period_id
        and membership.profile_id = auth.uid()
        and membership.is_active
    )
  order by task.deadline_at asc;
$$;

revoke all on function public.get_my_calendar_task_deadlines(uuid) from public;
grant execute on function public.get_my_calendar_task_deadlines(uuid) to authenticated;
