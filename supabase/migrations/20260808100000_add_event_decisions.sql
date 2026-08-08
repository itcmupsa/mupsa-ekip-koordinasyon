-- MUPSA Ekip Koordinasyon
-- Faz 2 / Kararlar: etkinlik kararlarının kalıcı ve denetlenebilir kaydı

create table public.event_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  decision_text text not null check (char_length(trim(decision_text)) > 0),
  decided_at date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is null or deleted_by is not null)
);

create index event_decisions_event_id_idx
  on public.event_decisions(event_id, decided_at desc, created_at desc);

-- Faz 1'deki ortak trigger karar kayıtlarını da dönem kilidine bağlar.
create or replace function public.assert_related_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
  target_period_id uuid;
begin
  if tg_table_name in ('event_members', 'event_process_members', 'event_decisions') then
    if tg_op = 'DELETE' then
      target_event_id := old.event_id;
    else
      target_event_id := new.event_id;
    end if;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    select t.event_id into target_event_id
    from public.tasks t
    where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  else
    raise exception 'Desteklenmeyen tablo: %', tg_table_name;
  end if;

  select e.period_id into target_period_id
  from public.events e
  where e.id = target_event_id;

  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu donem kilitli oldugu icin ilgili kayit degistirilemez.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger event_decisions_set_updated_at
before update on public.event_decisions
for each row execute function public.set_updated_at();

create trigger event_decisions_assert_period_unlocked
before insert or update or delete on public.event_decisions
for each row execute function public.assert_related_event_period_unlocked();

create trigger audit_event_decisions
after insert or update or delete on public.event_decisions
for each row execute function public.record_audit_log('event_decision');

alter table public.audit_logs
  drop constraint audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check check (
    entity_type in (
      'event',
      'task',
      'event_process_member',
      'task_assignee',
      'task_dependency',
      'period_membership',
      'event_decision'
    )
  );

alter table public.event_decisions enable row level security;

create policy "active members read event decisions"
on public.event_decisions for select
using (public.is_active_member());

create policy "event managers create event decisions"
on public.event_decisions for insert
with check (
  public.is_active_member()
  and public.can_manage_event(event_id)
  and created_by = auth.uid()
);

create policy "event managers update event decisions"
on public.event_decisions for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

create policy "admins permanently delete event decisions"
on public.event_decisions for delete
using (public.is_super_admin());
