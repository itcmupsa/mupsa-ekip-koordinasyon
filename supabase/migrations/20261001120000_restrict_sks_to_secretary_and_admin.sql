-- SKS permissions follow the target period's roles, not event assignments.
-- Preserve historical assignments and all other process permissions.
create or replace function public.can_manage_event_process(target_event_id uuid, target_process_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when target_process_type = 'sks' then exists (
    select 1
    from public.events e
    join public.periods per on per.id = e.period_id and per.is_active
    join public.period_memberships pm on pm.period_id = e.period_id
      and pm.profile_id = auth.uid() and pm.is_active
    join public.profiles p on p.id = pm.profile_id and p.is_active
    join public.coordinator_roles cr on cr.id = pm.coordinator_role_id
    where e.id = target_event_id
      and (pm.app_role = 'super_admin' or cr.slug = 'general-secretary')
  ) else (
    public.is_super_admin()
    or public.can_manage_event(target_event_id)
    or exists (
      select 1 from public.event_process_members epm
      where epm.event_id = target_event_id
        and epm.process_type = target_process_type
        and epm.profile_id = auth.uid()
        and epm.responsibility_type = 'owner'
    )
  ) end;
$$;
