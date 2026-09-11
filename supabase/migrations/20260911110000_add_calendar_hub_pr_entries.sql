-- Calendar Hub: legacy manual entries gain explicit calendar placement and
-- colour; PR planning is kept in a separate, soft-deleteable source table.

create or replace function public.is_valid_calendar_scopes(scopes text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    cardinality(scopes) between 1 and 3
    and array_position(scopes, null) is null
    and scopes <@ array['events', 'awareness', 'pr']::text[]
    and cardinality(scopes) = (
      select count(distinct scope_value)
      from unnest(scopes) as scope_value
    ),
    false
  );
$$;

alter table public.calendar_entries
  add column calendar_scopes text[] not null default array['events', 'awareness']::text[],
  add column color text not null default '#7c3aed';

alter table public.calendar_entries
  add constraint calendar_entries_calendar_scopes_check
    check (public.is_valid_calendar_scopes(calendar_scopes)),
  add constraint calendar_entries_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$');

create table public.pr_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 240),
  entry_kind text not null default 'other' check (entry_kind in ('publication', 'shooting', 'other')),
  scheduled_date date not null,
  -- A local wall time. The client displays/interprets it in Europe/Istanbul.
  scheduled_time time without time zone,
  color text not null default '#7c3aed' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status text not null default 'draft' check (status in ('draft', 'planned', 'in_progress', 'ready', 'completed', 'cancelled')),
  channel text check (channel is null or char_length(trim(channel)) between 1 and 120),
  format text check (format is null or char_length(trim(format)) between 1 and 120),
  notes text,
  responsible_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  awareness_post_id uuid references public.awareness_posts(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  related_pr_entry_id uuid references public.pr_calendar_entries(id) on delete set null,
  reference_url text check (reference_url is null or reference_url ~* '^https?://'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  check (num_nonnulls(event_id, awareness_post_id) <= 1),
  check (deleted_at is null or deleted_by is not null)
);

create index pr_calendar_entries_period_date_idx
  on public.pr_calendar_entries(period_id, scheduled_date, scheduled_time)
  where deleted_at is null;

create index pr_calendar_entries_event_idx
  on public.pr_calendar_entries(event_id) where event_id is not null and deleted_at is null;

create index pr_calendar_entries_awareness_idx
  on public.pr_calendar_entries(awareness_post_id) where awareness_post_id is not null and deleted_at is null;

create index pr_calendar_entries_task_idx
  on public.pr_calendar_entries(task_id) where task_id is not null and deleted_at is null;

create or replace function public.can_manage_pr_calendar(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.periods period_record
    join public.period_memberships membership
      on membership.period_id = period_record.id
     and membership.profile_id = auth.uid()
     and membership.is_active
    join public.profiles profile_record
      on profile_record.id = membership.profile_id
     and profile_record.is_active
    left join public.coordinator_roles coordinator_role
      on coordinator_role.id = membership.coordinator_role_id
    where period_record.id = target_period_id
      and period_record.is_active
      and (
        membership.app_role = 'super_admin'
        or (coordinator_role.is_active and coordinator_role.slug = 'press-and-publication-coordinator')
      )
  );
$$;

create or replace function public.assert_pr_calendar_entry_relations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_task_event_id uuid;
  linked_task_awareness_post_id uuid;
  is_parent_cleanup boolean := false;
  validate_responsible boolean := tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id;
  validate_event boolean := tg_op = 'INSERT' or new.event_id is distinct from old.event_id;
  validate_awareness boolean := tg_op = 'INSERT' or new.awareness_post_id is distinct from old.awareness_post_id;
  validate_task boolean := tg_op = 'INSERT'
    or new.task_id is distinct from old.task_id
    or new.event_id is distinct from old.event_id
    or new.awareness_post_id is distinct from old.awareness_post_id;
  validate_related_pr boolean := tg_op = 'INSERT' or new.related_pr_entry_id is distinct from old.related_pr_entry_id;
begin
  -- Historical links remain readable/editable after their parent is
  -- soft-deleted or a responsible leaves the period. Only a new/changed link
  -- must resolve to an active same-period record.
  if validate_responsible and new.responsible_id is not null and not exists (
    select 1
    from public.profiles profile_record
    join public.period_memberships membership
      on membership.profile_id = profile_record.id
    where profile_record.id = new.responsible_id
      and profile_record.is_active
      and membership.period_id = new.period_id
      and membership.is_active
  ) then
    raise exception 'Sorumlu, bu dönemin aktif üyesi olmalıdır.';
  end if;

  if validate_event and new.event_id is not null and not exists (
    select 1 from public.events event_record
    where event_record.id = new.event_id
      and event_record.period_id = new.period_id
      and event_record.deleted_at is null
  ) then
    raise exception 'Bağlı etkinlik aktif olmalı ve aynı dönemde bulunmalıdır.';
  end if;

  if validate_awareness and new.awareness_post_id is not null and not exists (
    select 1 from public.awareness_posts awareness_record
    where awareness_record.id = new.awareness_post_id
      and awareness_record.period_id = new.period_id
      and awareness_record.deleted_at is null
  ) then
    raise exception 'Bağlı farkındalık kaydı aktif olmalı ve aynı dönemde bulunmalıdır.';
  end if;

  -- ON DELETE SET NULL clean-up must not be rejected when a protected legacy
  -- parent is permanently deleted. A direct unlink still reaches the checks.
  if tg_op = 'UPDATE' then
    is_parent_cleanup := (
      (old.event_id is not null and new.event_id is null
        and not exists (select 1 from public.events where id = old.event_id))
      or (old.awareness_post_id is not null and new.awareness_post_id is null
        and not exists (select 1 from public.awareness_posts where id = old.awareness_post_id))
    );
  end if;

  if validate_task and new.task_id is not null and not is_parent_cleanup then
    select task_record.event_id, task_record.awareness_post_id
      into linked_task_event_id, linked_task_awareness_post_id
    from public.tasks task_record
    where task_record.id = new.task_id
      and task_record.period_id = new.period_id
      and task_record.deleted_at is null;

    if not found then
      raise exception 'Bağlı görev aktif olmalı ve aynı dönemde bulunmalıdır.';
    end if;

    if not is_parent_cleanup
       and (linked_task_event_id is distinct from new.event_id
            or linked_task_awareness_post_id is distinct from new.awareness_post_id) then
      raise exception 'Bağlı görev, seçilen etkinlik veya farkındalık kaydıyla tutarlı olmalıdır.';
    end if;
  end if;

  if validate_related_pr and new.related_pr_entry_id is not null then
    if new.related_pr_entry_id = new.id then
      raise exception 'PR takvim kaydı kendisiyle ilişkilendirilemez.';
    end if;
    if not exists (
      select 1 from public.pr_calendar_entries related_entry
      where related_entry.id = new.related_pr_entry_id
        and related_entry.period_id = new.period_id
        and related_entry.deleted_at is null
    ) then
      raise exception 'İlişkili PR takvim kaydı aktif olmalı ve aynı dönemde bulunmalıdır.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assert_pr_calendar_entry_period_unlocked()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_period_locked(new.period_id) then
    raise exception 'Bu dönem kilitli olduğu için PR takvim kaydı değiştirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_pr_calendar_entry_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.period_id is distinct from old.period_id
     or new.created_by is distinct from old.created_by
     or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'PR takvim kaydının dönemi ve oluşturan kişi değiştirilemez.';
  end if;
  return new;
end;
$$;

create or replace function public.pr_calendar_entry_audit_payload(entry_record public.pr_calendar_entries)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', entry_record.id,
    'period_id', entry_record.period_id,
    'title', entry_record.title,
    'entry_kind', entry_record.entry_kind,
    'scheduled_date', entry_record.scheduled_date,
    'scheduled_time', entry_record.scheduled_time,
    'color', entry_record.color,
    'status', entry_record.status,
    'channel', entry_record.channel,
    'format', entry_record.format,
    'responsible_id', entry_record.responsible_id,
    'event_id', entry_record.event_id,
    'awareness_post_id', entry_record.awareness_post_id,
    'task_id', entry_record.task_id,
    'related_pr_entry_id', entry_record.related_pr_entry_id,
    'created_by', entry_record.created_by,
    'deleted_at', entry_record.deleted_at,
    'deleted_by', entry_record.deleted_by
  );
$$;

create or replace function public.record_pr_calendar_entry_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
    values (auth.uid(), 'pr_calendar_entry', new.id, 'created', public.pr_calendar_entry_audit_payload(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), 'pr_calendar_entry', new.id, 'updated', public.pr_calendar_entry_audit_payload(old), public.pr_calendar_entry_audit_payload(new));
    return new;
  else
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data)
    values (auth.uid(), 'pr_calendar_entry', old.id, 'deleted', public.pr_calendar_entry_audit_payload(old));
    return old;
  end if;
end;
$$;

create trigger pr_calendar_entries_set_updated_at
before update on public.pr_calendar_entries
for each row execute function public.set_updated_at();

create trigger pr_calendar_entries_assert_relations
before insert or update on public.pr_calendar_entries
for each row execute function public.assert_pr_calendar_entry_relations();

create trigger pr_calendar_entries_assert_period_unlocked
before insert or update on public.pr_calendar_entries
for each row execute function public.assert_pr_calendar_entry_period_unlocked();

create trigger pr_calendar_entries_enforce_write_permissions
before update on public.pr_calendar_entries
for each row execute function public.enforce_pr_calendar_entry_write_permissions();

create trigger audit_pr_calendar_entries
after insert or update or delete on public.pr_calendar_entries
for each row execute function public.record_pr_calendar_entry_audit();

alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (entity_type in (
  'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
  'period_membership', 'event_decision', 'event_report', 'event_link',
  'event_file', 'event_budget_sponsor', 'awareness_post', 'calendar_entry',
  'admin_announcement', 'pr_calendar_entry'
));

alter table public.pr_calendar_entries enable row level security;

create policy "active target-period members read PR calendar entries"
on public.pr_calendar_entries for select
using (
  exists (
    select 1
    from public.periods period_record
    join public.period_memberships membership
      on membership.period_id = period_record.id
     and membership.profile_id = auth.uid()
     and membership.is_active
    join public.profiles profile_record
      on profile_record.id = membership.profile_id
     and profile_record.is_active
    where period_record.id = pr_calendar_entries.period_id
      and period_record.is_active
      and (pr_calendar_entries.deleted_at is null or membership.app_role = 'super_admin')
  )
);

create policy "PR calendar managers insert entries"
on public.pr_calendar_entries for insert
with check (
  public.can_manage_pr_calendar(period_id)
  and created_by = auth.uid()
);

create policy "PR calendar managers update entries"
on public.pr_calendar_entries for update
using (public.can_manage_pr_calendar(period_id))
with check (public.can_manage_pr_calendar(period_id));

-- Existing RPC remains unchanged. This additive v2 endpoint includes every
-- supported task context so the Calendar can route event/awareness/central work.
create function public.get_my_calendar_task_deadlines_v2(target_period_id uuid)
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  title text,
  deadline_at timestamptz,
  awareness_post_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    task.id,
    task.event_id,
    coalesce(event_record.title, awareness_record.awareness_name, 'Bağımsız görev'),
    task.title,
    task.deadline_at,
    task.awareness_post_id
  from public.tasks task
  left join public.events event_record on event_record.id = task.event_id
  left join public.awareness_posts awareness_record on awareness_record.id = task.awareness_post_id
  join public.task_assignees assignee on assignee.task_id = task.id
  join public.profiles profile_record on profile_record.id = auth.uid() and profile_record.is_active
  join public.period_memberships membership
    on membership.period_id = target_period_id
   and membership.profile_id = auth.uid()
   and membership.is_active
  join public.periods period_record
    on period_record.id = target_period_id
   and period_record.is_active
  where assignee.profile_id = auth.uid()
    and assignee.assignment_type in ('primary', 'supporting')
    and task.period_id = target_period_id
    and (event_record.id is null or event_record.deleted_at is null)
    and (awareness_record.id is null or awareness_record.deleted_at is null)
    and task.activation_status = 'active'
    and task.progress_status not in ('completed', 'cancelled')
    and task.deleted_at is null
    and task.deadline_at is not null
  order by task.deadline_at asc;
$$;

revoke all on function public.can_manage_pr_calendar(uuid) from public;
grant execute on function public.can_manage_pr_calendar(uuid) to authenticated;
revoke all on function public.get_my_calendar_task_deadlines_v2(uuid) from public;
grant execute on function public.get_my_calendar_task_deadlines_v2(uuid) to authenticated;

-- Explicit Data API surface: no permanent client deletion.
revoke all on public.pr_calendar_entries from anon, authenticated;
grant select, insert, update on public.pr_calendar_entries to authenticated;

-- A coordinator cannot SELECT inactive rows; use a checked command to avoid
-- UPDATE's SELECT policy rejecting the transition to an inactive row.
create function public.set_pr_calendar_entry_inactive(target_entry_id uuid, inactive boolean)
returns void language plpgsql security definer set search_path = public as $$
declare target_period uuid;
begin
  select period_id into target_period from public.pr_calendar_entries where id = target_entry_id;
  if target_period is null or not public.can_manage_pr_calendar(target_period) then
    raise exception 'Bu PR kaydını değiştirme yetkiniz yok.';
  end if;
  update public.pr_calendar_entries
  set deleted_at = case when inactive then now() else null end,
      deleted_by = case when inactive then auth.uid() else null end
  where id = target_entry_id;
end;
$$;
revoke all on function public.set_pr_calendar_entry_inactive(uuid, boolean) from public;
grant execute on function public.set_pr_calendar_entry_inactive(uuid, boolean) to authenticated;
