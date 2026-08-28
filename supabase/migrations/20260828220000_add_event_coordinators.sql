-- Ortak etkinlik koordinatörleri: ana sahip korunur, bir etkinliğe birden fazla ortak koordinatör eklenebilir.

create table public.event_coordinators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_coordinators_event_id_idx on public.event_coordinators(event_id);
create index event_coordinators_profile_id_idx on public.event_coordinators(profile_id);

alter table public.event_coordinators enable row level security;
grant select, insert, update, delete on public.event_coordinators to authenticated;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.events e
      where e.id = target_event_id and e.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.event_coordinators ec
      where ec.event_id = target_event_id and ec.profile_id = auth.uid()
    );
$$;

create or replace function public.can_manage_event_coordinators(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.events e
      where e.id = target_event_id and e.owner_id = auth.uid()
    );
$$;

create or replace function public.can_manage_event_process(target_event_id uuid, target_process_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_event(target_event_id)
    or exists (
      select 1
      from public.event_process_members epm
      where epm.event_id = target_event_id
        and epm.process_type = target_process_type
        and epm.profile_id = auth.uid()
        and epm.responsibility_type = 'owner'
    );
$$;

create or replace function public.can_manage_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = target_task_id
        and public.can_manage_event(t.event_id)
    )
    or exists (
      select 1
      from public.tasks t
      join public.event_process_members epm
        on epm.event_id = t.event_id
       and epm.process_type = t.process_type
      where t.id = target_task_id
        and epm.profile_id = auth.uid()
        and epm.responsibility_type = 'owner'
    );
$$;

create or replace function public.assert_event_coordinator_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
  target_profile_id uuid;
  event_owner uuid;
  event_period uuid;
begin
  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  target_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;

  select e.owner_id, e.period_id into event_owner, event_period
  from public.events e where e.id = target_event_id;

  if event_owner is null then
    raise exception 'Etkinlik bulunamadı.';
  end if;
  if not public.is_super_admin() and public.is_period_locked(event_period) then
    raise exception 'Bu dönem kilitli olduğu için ortak koordinatör değiştirilemez.';
  end if;

  if tg_op <> 'DELETE' then
    if target_profile_id = event_owner then
      raise exception 'Ana koordinatör ayrıca ortak koordinatör olarak eklenemez.';
    end if;
    if not exists (
      select 1 from public.period_memberships pm
      join public.profiles p on p.id = pm.profile_id
      where pm.period_id = event_period
        and pm.profile_id = target_profile_id
        and pm.is_active
        and p.is_active
    ) then
      raise exception 'Ortak koordinatör aktif etkinlik döneminde yer almalıdır.';
    end if;
    return new;
  end if;

  return old;
end;
$$;

create trigger event_coordinators_assert_context
before insert or update or delete on public.event_coordinators
for each row execute function public.assert_event_coordinator_context();

create policy "active members read event coordinators"
  on public.event_coordinators for select
  using (public.is_active_member());

create policy "event owners manage event coordinators insert"
  on public.event_coordinators for insert
  with check (
    public.is_active_member()
    and public.can_manage_event_coordinators(event_id)
    and added_by = auth.uid()
  );

create policy "event owners manage event coordinators update"
  on public.event_coordinators for update
  using (public.can_manage_event_coordinators(event_id))
  with check (public.can_manage_event_coordinators(event_id));

create policy "event owners manage event coordinators delete"
  on public.event_coordinators for delete
  using (public.can_manage_event_coordinators(event_id));

create or replace function public.create_event_with_coordinators(
  p_period_id uuid,
  p_title text,
  p_description text,
  p_planning_date date,
  p_estimated_date date,
  p_preparation_start_date date,
  p_coordinator_profile_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_event_id uuid;
  coordinator_profile_id uuid;
begin
  if not public.is_active_member() then
    raise exception 'Aktif üyelik bulunamadı.';
  end if;
  if public.is_period_locked(p_period_id) then
    raise exception 'Bu dönem kilitli olduğu için etkinlik oluşturulamaz.';
  end if;
  if not exists (
    select 1 from public.period_memberships pm
    where pm.period_id = p_period_id
      and pm.profile_id = auth.uid()
      and pm.is_active
  ) then
    raise exception 'Bu dönemde etkinlik oluşturma yetkiniz yok.';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'Etkinlik adı zorunludur.';
  end if;

  insert into public.events (
    period_id, title, description, created_by, owner_id,
    planning_date, estimated_date, preparation_start_date
  ) values (
    p_period_id, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), auth.uid(), auth.uid(),
    p_planning_date, p_estimated_date, p_preparation_start_date
  ) returning id into new_event_id;

  for coordinator_profile_id in
    select distinct unnest(coalesce(p_coordinator_profile_ids, '{}'::uuid[]))
  loop
    if coordinator_profile_id <> auth.uid() then
      insert into public.event_coordinators (event_id, profile_id, added_by)
      values (new_event_id, coordinator_profile_id, auth.uid());
    end if;
  end loop;

  return new_event_id;
end;
$$;

revoke all on function public.create_event_with_coordinators(uuid, text, text, date, date, date, uuid[]) from public;
grant execute on function public.create_event_with_coordinators(uuid, text, text, date, date, date, uuid[]) to authenticated;

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_manager boolean;
  is_sks_owner boolean;
  is_design_owner boolean;
  allowed_fields text[] := array['updated_at'];
begin
  if public.is_super_admin() then
    return new;
  end if;

  is_event_manager := public.can_manage_event(old.id);
  is_sks_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type = 'sks'
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );
  is_design_owner := exists (
    select 1 from public.event_process_members member
    where member.event_id = old.id and member.process_type in ('design', 'press')
      and member.profile_id = auth.uid() and member.responsibility_type = 'owner'
  );

  if is_event_manager then
    allowed_fields := allowed_fields || array[
      'title', 'description', 'event_status', 'planning_date', 'estimated_date',
      'preparation_start_date', 'confirmed_date', 'venue', 'next_action',
      'general_note', 'report_status'
    ];
  end if;
  if is_sks_owner then allowed_fields := allowed_fields || array['sks_status']; end if;
  if is_design_owner then allowed_fields := allowed_fields || array['design_announcement_status']; end if;
  if public.can_access_event_budget() then
    allowed_fields := allowed_fields || array[
      'budget_status', 'estimated_budget', 'approved_budget', 'actual_expense', 'budget_note'
    ];
  end if;

  if not (is_event_manager or is_sks_owner or is_design_owner or public.can_access_event_budget()) then
    raise exception 'Bu etkinliği düzenleme yetkiniz yok.';
  end if;
  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Kullanıcı rolünüz bu alanlardan bazılarını değiştirme yetkisine sahip değil.';
  end if;
  if is_event_manager
    and new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayı olmadan etkinlik tamamlanmış olarak işaretlenemez.';
  end if;
  return new;
end;
$$;
