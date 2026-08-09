-- MUPSA Ekip Koordinasyon
-- Faz 2: Bütçe sponsorları

create table public.event_budget_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  sponsor_name text not null check (char_length(trim(sponsor_name)) > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_note text,
  check (deleted_at is null or deleted_by is not null)
);

create index event_budget_sponsors_event_id_idx
  on public.event_budget_sponsors(event_id, created_at desc);

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check check (
    entity_type in (
      'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
      'period_membership', 'event_decision', 'event_report', 'event_link', 'event_file',
      'event_budget_sponsor'
    )
  );

create or replace function public.assert_related_event_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
  target_period_id uuid;
begin
  if tg_table_name in ('event_members', 'event_process_members', 'event_decisions', 'event_reports', 'event_budget_sponsors') then
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  elsif tg_table_name in ('task_assignees', 'task_dependencies') then
    select t.event_id into target_event_id
    from public.tasks t
    where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
  elsif tg_table_name in ('event_links', 'event_files') then
    if (case when tg_op = 'DELETE' then old.event_id else new.event_id end) is not null then
      target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
    else
      select t.event_id into target_event_id
      from public.tasks t
      where t.id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
    end if;
  else
    raise exception 'Desteklenmeyen tablo: %', tg_table_name;
  end if;

  select e.period_id into target_period_id
  from public.events e
  where e.id = target_event_id;

  if not public.is_super_admin() and public.is_period_locked(target_period_id) then
    raise exception 'Bu dönem kilitli olduğu için ilgili kayıt değiştirilemez.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger event_budget_sponsors_set_updated_at
before update on public.event_budget_sponsors
for each row execute function public.set_updated_at();

create trigger event_budget_sponsors_assert_period_unlocked
before insert or update or delete on public.event_budget_sponsors
for each row execute function public.assert_related_event_period_unlocked();

create trigger audit_event_budget_sponsors
after insert or update or delete on public.event_budget_sponsors
for each row execute function public.record_audit_log('event_budget_sponsor');

alter table public.event_budget_sponsors enable row level security;

create policy "active members read event budget sponsors"
  on public.event_budget_sponsors for select
  using (public.is_active_member());

create policy "budget managers insert event budget sponsors"
  on public.event_budget_sponsors for insert
  with check (
    public.is_active_member()
    and created_by = auth.uid()
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.event_process_members member
        where member.event_id = event_budget_sponsors.event_id
          and member.process_type = 'budget'
          and member.responsibility_type = 'owner'
          and member.profile_id = auth.uid()
      )
    )
  );

create policy "budget managers update event budget sponsors"
  on public.event_budget_sponsors for update
  using (
    public.is_active_member()
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.event_process_members member
        where member.event_id = event_budget_sponsors.event_id
          and member.process_type = 'budget'
          and member.responsibility_type = 'owner'
          and member.profile_id = auth.uid()
      )
    )
  )
  with check (
    public.is_active_member()
    and (
      public.is_super_admin()
      or exists (
        select 1
        from public.event_process_members member
        where member.event_id = event_budget_sponsors.event_id
          and member.process_type = 'budget'
          and member.responsibility_type = 'owner'
          and member.profile_id = auth.uid()
      )
    )
  );

create policy "admins permanently delete event budget sponsors"
  on public.event_budget_sponsors for delete
  using (public.is_super_admin());
