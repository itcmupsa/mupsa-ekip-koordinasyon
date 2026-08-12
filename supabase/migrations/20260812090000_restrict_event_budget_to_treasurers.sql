-- Etkinlik bütçe verileri yalnızca aktif Sayman ve Süper Yöneticilere açıktır.

create or replace function public.can_access_event_budget()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.period_memberships membership
      join public.periods period_record on period_record.id = membership.period_id
      join public.coordinator_roles coordinator_role on coordinator_role.id = membership.coordinator_role_id
      where membership.profile_id = auth.uid()
        and membership.is_active
        and period_record.is_active
        and coordinator_role.slug = 'treasurer'
    );
$$;

revoke all on function public.can_access_event_budget() from public;
grant execute on function public.can_access_event_budget() to authenticated;

create or replace function public.get_event_budget(target_event_id uuid)
returns table (
  budget_status text,
  estimated_budget numeric,
  approved_budget numeric,
  actual_expense numeric,
  budget_note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_access_event_budget() then
    raise exception 'Bütçe bilgilerini görüntüleme yetkiniz bulunmuyor.';
  end if;

  return query
  select event_record.budget_status,
         event_record.estimated_budget,
         event_record.approved_budget,
         event_record.actual_expense,
         event_record.budget_note
  from public.events event_record
  where event_record.id = target_event_id
    and event_record.deleted_at is null
    and exists (
      select 1
      from public.period_memberships membership
      where membership.period_id = event_record.period_id
        and membership.profile_id = auth.uid()
        and membership.is_active
    );
end;
$$;

revoke all on function public.get_event_budget(uuid) from public;
grant execute on function public.get_event_budget(uuid) to authenticated;

-- PostgREST üzerinden bütçe kolonlarının doğrudan seçilmesini de engelle.
-- Yetkili istemciler bu alanları get_event_budget RPC'si üzerinden okur.
revoke select on public.events from public, anon, authenticated;
grant select (
  id, period_id, title, description, created_by, owner_id, event_status, sks_status,
  planning_date, estimated_date, preparation_start_date, confirmed_date, venue,
  next_action, general_note, deleted_at, deleted_by, deletion_note, created_at,
  updated_at, design_announcement_status, report_status
) on public.events to authenticated;

drop policy if exists "active members read budget statuses" on public.budget_statuses;
create policy "treasurers and admins read budget statuses"
  on public.budget_statuses for select
  using (public.can_access_event_budget());

drop policy if exists "active members read event budget sponsors" on public.event_budget_sponsors;
create policy "treasurers and admins read event budget sponsors"
  on public.event_budget_sponsors for select
  using (public.can_access_event_budget());

drop policy if exists "budget managers insert event budget sponsors" on public.event_budget_sponsors;
create policy "treasurers and admins insert event budget sponsors"
  on public.event_budget_sponsors for insert
  with check (public.can_access_event_budget() and created_by = auth.uid());

drop policy if exists "budget managers update event budget sponsors" on public.event_budget_sponsors;
create policy "treasurers and admins update event budget sponsors"
  on public.event_budget_sponsors for update
  using (public.can_access_event_budget())
  with check (public.can_access_event_budget());

drop policy if exists "active members read process members" on public.event_process_members;
create policy "members read permitted process members"
  on public.event_process_members for select
  using (
    public.is_active_member()
    and (process_type <> 'budget' or public.can_access_event_budget())
  );

drop policy if exists "authorized members add process members" on public.event_process_members;
create policy "authorized members add process members"
  on public.event_process_members for insert
  with check (
    public.is_active_member()
    and assigned_by = auth.uid()
    and (
      (process_type = 'budget' and public.can_access_event_budget())
      or (process_type <> 'budget' and public.can_manage_event_process(event_id, process_type))
    )
  );

drop policy if exists "authorized members update process members" on public.event_process_members;
create policy "authorized members update process members"
  on public.event_process_members for update
  using (
    (process_type = 'budget' and public.can_access_event_budget())
    or (process_type <> 'budget' and public.can_manage_event_process(event_id, process_type))
  )
  with check (
    (process_type = 'budget' and public.can_access_event_budget())
    or (process_type <> 'budget' and public.can_manage_event_process(event_id, process_type))
  );

drop policy if exists "authorized members remove process members" on public.event_process_members;
create policy "authorized members remove process members"
  on public.event_process_members for delete
  using (
    (process_type = 'budget' and public.can_access_event_budget())
    or (process_type <> 'budget' and public.can_manage_event_process(event_id, process_type))
  );

create or replace function public.enforce_event_write_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_event_owner boolean;
  is_sks_owner boolean;
  is_design_owner boolean;
  allowed_fields text[] := array['updated_at'];
begin
  if public.is_super_admin() then
    return new;
  end if;

  is_event_owner := old.owner_id = auth.uid();
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

  if is_event_owner then
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

  if not (is_event_owner or is_sks_owner or is_design_owner or public.can_access_event_budget()) then
    raise exception 'Bu etkinliği düzenleme yetkiniz yok.';
  end if;
  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Kullanıcı rolünüz bu alanlardan bazılarını değiştirme yetkisine sahip değil.';
  end if;
  if is_event_owner
    and new.event_status in ('completed', 'reported', 'archived')
    and coalesce(new.sks_status, '') not in ('not_required', 'approved') then
    raise exception 'SKS onayı olmadan etkinlik tamamlanmış olarak işaretlenemez.';
  end if;
  return new;
end;
$$;

drop policy if exists "authorized members update events" on public.events;
create policy "authorized members update events"
  on public.events for update
  using (
    public.is_active_member()
    and (
      public.can_manage_event(id)
      or public.can_access_event_budget()
      or exists (
        select 1 from public.event_process_members member
        where member.event_id = id
          and member.process_type in ('sks', 'design', 'press')
          and member.profile_id = auth.uid()
          and member.responsibility_type = 'owner'
      )
    )
  )
  with check (public.is_active_member());
