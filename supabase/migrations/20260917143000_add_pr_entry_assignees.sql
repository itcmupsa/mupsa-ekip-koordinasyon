-- PR calendar entry assignees: many assignees per PR entry with manual and
-- automatic sources. This migration is additive and keeps responsible_id for
-- backwards compatibility.

create table public.pr_calendar_entry_assignees (
  pr_entry_id uuid not null references public.pr_calendar_entries(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  assignment_source text not null check (assignment_source in ('manual', 'event_owner', 'awareness_responsible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pr_entry_id, profile_id, assignment_source)
);

create index pr_calendar_entry_assignees_profile_idx
  on public.pr_calendar_entry_assignees(profile_id, pr_entry_id);

create trigger pr_calendar_entry_assignees_set_updated_at
before update on public.pr_calendar_entry_assignees
for each row execute function public.set_updated_at();

create or replace function public.is_active_member_of_period(target_period_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile_record
    join public.period_memberships membership
      on membership.profile_id = profile_record.id
    join public.periods period_record
      on period_record.id = membership.period_id
    where profile_record.id = target_profile_id
      and profile_record.is_active
      and membership.period_id = target_period_id
      and membership.is_active
      and period_record.is_active
  );
$$;

create or replace function public.can_update_assigned_pr_calendar_entry(target_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pr_calendar_entries entry
    join public.pr_calendar_entry_assignees assignee
      on assignee.pr_entry_id = entry.id
     and assignee.profile_id = auth.uid()
    where entry.id = target_entry_id
      and entry.deleted_at is null
      and public.is_active_member_of_period(entry.period_id, auth.uid())
  );
$$;

create or replace function public.assert_pr_calendar_assignee_relations()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_period uuid;
  target_pr_entry_id uuid;
begin
  target_pr_entry_id := coalesce(new.pr_entry_id, old.pr_entry_id);

  select period_id into target_period
  from public.pr_calendar_entries
  where id = target_pr_entry_id;

  if target_period is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'PR kaydı bulunamadı.';
  end if;

  if public.is_period_locked(target_period) then
    raise exception 'Bu dönem kilitli olduğu için PR ataması değiştirilemez.';
  end if;

  if tg_op != 'DELETE' then
    if not public.is_active_member_of_period(target_period, new.profile_id) then
      raise exception 'PR atanan kişi bu dönemin aktif üyesi olmalıdır.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.pr_calendar_entry_operational_payload_changed(old_row public.pr_calendar_entries, new_row public.pr_calendar_entries)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  return new_row.title is distinct from old_row.title
    or new_row.entry_kind is distinct from old_row.entry_kind
    or new_row.scheduled_date is distinct from old_row.scheduled_date
    or new_row.scheduled_time is distinct from old_row.scheduled_time
    or new_row.color is distinct from old_row.color
    or new_row.status is distinct from old_row.status
    or new_row.channel is distinct from old_row.channel
    or new_row.channels is distinct from old_row.channels
    or new_row.format is distinct from old_row.format
    or new_row.notes is distinct from old_row.notes
    or new_row.reference_url is distinct from old_row.reference_url
    or new_row.reference_label is distinct from old_row.reference_label
    or new_row.reference_links is distinct from old_row.reference_links;
end;
$$;

create or replace function public.enforce_pr_calendar_entry_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new is not distinct from old then
    return new;
  end if;

  if public.can_manage_pr_calendar(old.period_id) then
    if new.period_id is distinct from old.period_id
       or new.created_by is distinct from old.created_by
       or new.id is distinct from old.id
       or new.created_at is distinct from old.created_at then
      raise exception 'PR takvim kaydının dönemi ve oluşturan kişi değiştirilemez.';
    end if;
    return new;
  end if;

  if public.can_update_assigned_pr_calendar_entry(old.id) then
    if new is distinct from old then
      if new.period_id is distinct from old.period_id
         or new.created_by is distinct from old.created_by
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at
         or new.responsible_id is distinct from old.responsible_id
         or new.event_id is distinct from old.event_id
         or new.awareness_post_id is distinct from old.awareness_post_id
         or new.task_id is distinct from old.task_id
         or new.related_pr_entry_id is distinct from old.related_pr_entry_id
         or new.deleted_at is distinct from old.deleted_at
         or new.deleted_by is distinct from old.deleted_by then
        raise exception 'Atanan kişi yalnızca PR kaydının operasyonel içeriğini güncelleyebilir.';
      end if;
      if not public.pr_calendar_entry_operational_payload_changed(old, new) then
        raise exception 'Atanan kişi bu PR kaydında yalnızca operasyonel alanları değiştirebilir.';
      end if;
    end if;
    return new;
  end if;

  raise exception 'Bu PR takvim kaydını değiştirme yetkiniz yok.';
end;
$$;

drop trigger if exists pr_calendar_entries_enforce_write_permissions on public.pr_calendar_entries;
create trigger pr_calendar_entries_01_enforce_write_permissions
before update on public.pr_calendar_entries
for each row execute function public.enforce_pr_calendar_entry_write_permissions();

create or replace function public.sync_pr_calendar_entry_auto_assignees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_owner uuid;
  awareness_responsible uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.event_id is not null then
    select owner_id into event_owner
    from public.events
    where id = new.event_id
      and period_id = new.period_id
      and deleted_at is null;

    if event_owner is not null and not public.is_active_member_of_period(new.period_id, event_owner) then
      event_owner := null;
    end if;
  end if;

  delete from public.pr_calendar_entry_assignees
  where pr_entry_id = new.id
    and assignment_source = 'event_owner'
    and (event_owner is null or profile_id != event_owner);

  if event_owner is not null then
    insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
    values (new.id, event_owner, 'event_owner')
    on conflict do nothing;
  end if;

  if new.awareness_post_id is not null then
    select press_publication_responsible_id into awareness_responsible
    from public.awareness_posts
    where id = new.awareness_post_id
      and period_id = new.period_id
      and deleted_at is null;

    if awareness_responsible is not null and not public.is_active_member_of_period(new.period_id, awareness_responsible) then
      awareness_responsible := null;
    end if;
  end if;

  delete from public.pr_calendar_entry_assignees
  where pr_entry_id = new.id
    and assignment_source = 'awareness_responsible'
    and (awareness_responsible is null or profile_id != awareness_responsible);

  if awareness_responsible is not null then
    insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
    values (new.id, awareness_responsible, 'awareness_responsible')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger pr_calendar_entries_sync_auto_assignees
after insert or update of period_id, event_id, awareness_post_id on public.pr_calendar_entries
for each row execute function public.sync_pr_calendar_entry_auto_assignees();

create or replace function public.refresh_pr_auto_assignees_for_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pr_calendar_entries
  set event_id = event_id
  where event_id = new.id
    and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id or new.deleted_at is distinct from old.deleted_at);
  return new;
end;
$$;

create trigger events_refresh_pr_auto_assignees
after insert or update of owner_id, deleted_at on public.events
for each row execute function public.refresh_pr_auto_assignees_for_event();

create or replace function public.refresh_pr_auto_assignees_for_awareness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pr_calendar_entries
  set awareness_post_id = awareness_post_id
  where awareness_post_id = new.id
    and (tg_op = 'INSERT' or new.press_publication_responsible_id is distinct from old.press_publication_responsible_id or new.deleted_at is distinct from old.deleted_at);
  return new;
end;
$$;

create trigger awareness_refresh_pr_auto_assignees
after insert or update of press_publication_responsible_id, deleted_at on public.awareness_posts
for each row execute function public.refresh_pr_auto_assignees_for_awareness();

alter table public.pr_calendar_entries disable trigger audit_pr_calendar_entries;
insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
select entry.id, entry.responsible_id, 'manual'
from public.pr_calendar_entries entry
where entry.responsible_id is not null
  and public.is_active_member_of_period(entry.period_id, entry.responsible_id)
on conflict do nothing;

insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
select entry.id, event_record.owner_id, 'event_owner'
from public.pr_calendar_entries entry
join public.events event_record on event_record.id = entry.event_id
where event_record.deleted_at is null
  and public.is_active_member_of_period(entry.period_id, event_record.owner_id)
on conflict do nothing;

insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
select entry.id, awareness.press_publication_responsible_id, 'awareness_responsible'
from public.pr_calendar_entries entry
join public.awareness_posts awareness on awareness.id = entry.awareness_post_id
where awareness.deleted_at is null
  and awareness.press_publication_responsible_id is not null
  and public.is_active_member_of_period(entry.period_id, awareness.press_publication_responsible_id)
on conflict do nothing;
alter table public.pr_calendar_entries enable trigger audit_pr_calendar_entries;

create trigger pr_calendar_entry_assignees_assert_relations
before insert or update or delete on public.pr_calendar_entry_assignees
for each row execute function public.assert_pr_calendar_assignee_relations();

create or replace function public.pr_calendar_entry_assignee_audit_payload(assignee_record public.pr_calendar_entry_assignees)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'pr_entry_id', assignee_record.pr_entry_id,
    'profile_id', assignee_record.profile_id,
    'assignment_source', assignee_record.assignment_source
  );
$$;

create or replace function public.record_pr_calendar_entry_assignee_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
    values (auth.uid(), 'pr_calendar_entry_assignee', new.pr_entry_id, 'created', public.pr_calendar_entry_assignee_audit_payload(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data, after_data)
    values (auth.uid(), 'pr_calendar_entry_assignee', new.pr_entry_id, 'updated', public.pr_calendar_entry_assignee_audit_payload(old), public.pr_calendar_entry_assignee_audit_payload(new));
    return new;
  else
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, before_data)
    values (auth.uid(), 'pr_calendar_entry_assignee', old.pr_entry_id, 'deleted', public.pr_calendar_entry_assignee_audit_payload(old));
    return old;
  end if;
end;
$$;

create trigger audit_pr_calendar_entry_assignees
after insert or update or delete on public.pr_calendar_entry_assignees
for each row execute function public.record_pr_calendar_entry_assignee_audit();

alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check check (entity_type in (
  'event', 'task', 'event_process_member', 'task_assignee', 'task_dependency',
  'period_membership', 'event_decision', 'event_report', 'event_link',
  'event_file', 'event_budget_sponsor', 'awareness_post', 'calendar_entry',
  'admin_announcement', 'pr_calendar_entry', 'pr_calendar_entry_assignee'
));

alter table public.pr_calendar_entry_assignees enable row level security;

create policy "active target-period members read PR entry assignees"
on public.pr_calendar_entry_assignees for select
using (
  exists (
    select 1
    from public.pr_calendar_entries entry
    where entry.id = pr_calendar_entry_assignees.pr_entry_id
      and entry.deleted_at is null
      and public.is_active_member_of_period(entry.period_id, auth.uid())
  )
);

create policy "PR calendar managers insert PR entry assignees"
on public.pr_calendar_entry_assignees for insert
with check (
  assignment_source = 'manual'
  and exists (
    select 1 from public.pr_calendar_entries entry
    where entry.id = pr_calendar_entry_assignees.pr_entry_id
      and public.can_manage_pr_calendar(entry.period_id)
  )
);

create policy "PR calendar managers update PR entry assignees"
on public.pr_calendar_entry_assignees for update
using (
  assignment_source = 'manual'
  and exists (
    select 1 from public.pr_calendar_entries entry
    where entry.id = pr_calendar_entry_assignees.pr_entry_id
      and public.can_manage_pr_calendar(entry.period_id)
  )
)
with check (
  assignment_source = 'manual'
  and exists (
    select 1 from public.pr_calendar_entries entry
    where entry.id = pr_calendar_entry_assignees.pr_entry_id
      and public.can_manage_pr_calendar(entry.period_id)
  )
);

create policy "PR calendar managers delete PR entry assignees"
on public.pr_calendar_entry_assignees for delete
using (
  assignment_source = 'manual'
  and exists (
    select 1 from public.pr_calendar_entries entry
    where entry.id = pr_calendar_entry_assignees.pr_entry_id
      and public.can_manage_pr_calendar(entry.period_id)
  )
);

drop policy if exists "PR calendar managers update entries" on public.pr_calendar_entries;
create policy "PR managers and assigned members update entries"
on public.pr_calendar_entries for update
using (public.can_manage_pr_calendar(period_id) or public.can_update_assigned_pr_calendar_entry(id))
with check (public.can_manage_pr_calendar(period_id) or public.can_update_assigned_pr_calendar_entry(id));

revoke all on public.pr_calendar_entry_assignees from anon, authenticated;
grant select, insert, update, delete on public.pr_calendar_entry_assignees to authenticated;
revoke all on function public.is_active_member_of_period(uuid, uuid) from public;
grant execute on function public.is_active_member_of_period(uuid, uuid) to authenticated;
revoke all on function public.can_update_assigned_pr_calendar_entry(uuid) from public;
grant execute on function public.can_update_assigned_pr_calendar_entry(uuid) to authenticated;
create or replace function public.upsert_pr_entry_with_manual_assignees(
  p_id uuid,
  p_period_id uuid,
  p_title text,
  p_entry_kind text,
  p_scheduled_date date,
  p_scheduled_time time,
  p_color text,
  p_status text,
  p_channels text[],
  p_channel text,
  p_format text,
  p_notes text,
  p_responsible_id uuid,
  p_event_id uuid,
  p_awareness_post_id uuid,
  p_task_id uuid,
  p_related_pr_entry_id uuid,
  p_reference_links jsonb,
  p_reference_label text,
  p_reference_url text,
  p_manual_assignees uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_uid uuid := auth.uid();
  v_assignee_id uuid;
  v_normalized_assignees uuid[];
  v_computed_responsible_id uuid;
begin
  if v_uid is null then
    raise exception 'Kimlik doğrulama hatası.';
  end if;

  v_normalized_assignees := coalesce(p_manual_assignees, array[]::uuid[]);

  if p_responsible_id is not null and p_responsible_id = any(v_normalized_assignees) then
    v_computed_responsible_id := p_responsible_id;
  elsif coalesce(array_length(v_normalized_assignees, 1), 0) > 0 then
    v_computed_responsible_id := v_normalized_assignees[1];
  else
    v_computed_responsible_id := null;
  end if;

  if not exists (select 1 from public.periods where id = p_period_id and is_active) then
    raise exception 'Dönem aktif değil.';
  end if;

  if public.is_period_locked(p_period_id) then
    raise exception 'Dönem kilitli.';
  end if;

  if not public.can_manage_pr_calendar(p_period_id) then
    raise exception 'Bu işlemi yapmaya yetkiniz yok.';
  end if;

  foreach v_assignee_id in array v_normalized_assignees loop
    if not public.is_active_member_of_period(p_period_id, v_assignee_id) then
      raise exception 'Manuel atanan üyelerden biri dönemin aktif üyesi değil.';
    end if;
  end loop;

  if p_id is not null then
    -- Update existing
    update public.pr_calendar_entries
    set
      title = p_title,
      entry_kind = p_entry_kind,
      scheduled_date = p_scheduled_date,
      scheduled_time = p_scheduled_time,
      color = p_color,
      status = p_status,
      channels = p_channels,
      channel = p_channel,
      format = p_format,
      notes = p_notes,
      responsible_id = v_computed_responsible_id,
      event_id = p_event_id,
      awareness_post_id = p_awareness_post_id,
      task_id = p_task_id,
      related_pr_entry_id = p_related_pr_entry_id,
      reference_links = p_reference_links,
      reference_label = p_reference_label,
      reference_url = p_reference_url
    where id = p_id
      and period_id = p_period_id -- Ensure period is not changed
      and deleted_at is null
    returning id into v_entry_id;

    if v_entry_id is null then
      raise exception 'Kayıt bulunamadı veya değiştirilemez.';
    end if;

    -- Replace manual assignees
    delete from public.pr_calendar_entry_assignees
    where pr_entry_id = v_entry_id and assignment_source = 'manual'
      and not (profile_id = any(v_normalized_assignees));

    if coalesce(array_length(v_normalized_assignees, 1), 0) > 0 then
      insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
      select v_entry_id, unnest(v_normalized_assignees), 'manual'
      on conflict do nothing;
    end if;

  else
    -- Insert new
    insert into public.pr_calendar_entries (
      period_id, created_by, title, entry_kind, scheduled_date, scheduled_time,
      color, status, channels, channel, format, notes, responsible_id,
      event_id, awareness_post_id, task_id, related_pr_entry_id,
      reference_links, reference_label, reference_url
    ) values (
      p_period_id, v_uid, p_title, p_entry_kind, p_scheduled_date, p_scheduled_time,
      p_color, p_status, p_channels, p_channel, p_format, p_notes, v_computed_responsible_id,
      p_event_id, p_awareness_post_id, p_task_id, p_related_pr_entry_id,
      p_reference_links, p_reference_label, p_reference_url
    ) returning id into v_entry_id;

    if coalesce(array_length(v_normalized_assignees, 1), 0) > 0 then
      insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
      select v_entry_id, unnest(v_normalized_assignees), 'manual'
      on conflict do nothing;
    end if;

  end if;

  return v_entry_id;
end;
$$;

revoke all on function public.upsert_pr_entry_with_manual_assignees from public;
revoke all on function public.upsert_pr_entry_with_manual_assignees from anon;
grant execute on function public.upsert_pr_entry_with_manual_assignees to authenticated;
