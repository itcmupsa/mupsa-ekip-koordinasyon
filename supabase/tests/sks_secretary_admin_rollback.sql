-- Run on the migrated schema. All fixtures and notifications are rolled back.
begin;
do $$
#variable_conflict use_variable
declare
  period_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  secretary_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  owner_id uuid := gen_random_uuid();
  coordinator_id uuid := gen_random_uuid();
  assigned_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  role_id uuid;
  secretary_role_id uuid;
  actor uuid;
  affected integer;
  blocked boolean;
begin
  select id into role_id from public.coordinator_roles where slug = 'public-relations-coordinator';
  select id into secretary_role_id from public.coordinator_roles where slug = 'general-secretary';
  insert into public.periods (id, slug, label, is_active)
  values (period_id, 'sks-test-' || period_id, 'SKS test ' || period_id, true);
  foreach actor in array array[secretary_id, admin_id, owner_id, coordinator_id, assigned_id, member_id] loop
    insert into auth.users (id, email, raw_user_meta_data)
    values (actor, actor || '@example.invalid', '{"display_name":"SKS test"}'::jsonb);
    insert into public.period_memberships (period_id, profile_id, coordinator_role_id, app_role, period_display_name)
    values (period_id, actor, case when actor = secretary_id then secretary_role_id else role_id end,
      case when actor = admin_id then 'super_admin' else 'coordinator' end, 'SKS test');
  end loop;
  insert into public.events (id, period_id, title, owner_id, created_by)
  values (event_id, period_id, 'SKS role test', owner_id, admin_id);
  insert into public.event_coordinators (event_id, profile_id, added_by)
  values (event_id, coordinator_id, admin_id);
  insert into public.event_process_members (event_id, profile_id, process_type, responsibility_type, assigned_by)
  values (event_id, assigned_id, 'sks', 'owner', admin_id);

  -- Actual authenticated updates exercise RLS and the field permission trigger.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', secretary_id::text, true);
  update public.events set sks_status = 'application_preparing' where id = event_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Secretary UPDATE blocked'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.events set sks_status = 'approved' where id = event_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Administrator UPDATE blocked'; end if;

  foreach actor in array array[owner_id, coordinator_id, assigned_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    if public.can_manage_event_process(event_id, 'sks') then
      raise exception 'Unexpected SKS permission for %', actor;
    end if;
    affected := 0;
    begin
      update public.events set sks_status = 'rejected' where id = event_id;
      get diagnostics affected = row_count;
    exception when others then
      affected := 0;
    end;
    if affected <> 0 or not exists (select 1 from public.events where id = event_id and sks_status = 'approved') then
      raise exception 'Unauthorized SKS update for %', actor;
    end if;
    affected := 0;
    begin
      delete from public.event_process_members m where m.event_id = event_id and m.process_type = 'sks';
      get diagnostics affected = row_count;
    exception when others then
      affected := 0;
    end;
    if affected <> 0 then raise exception 'Unauthorized SKS assignment delete'; end if;
  end loop;

  -- Owner retains general editing, but secretary cannot transfer ownership.
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  update public.events set title = 'Owner general update' where id = event_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'General event permission regressed'; end if;
  perform set_config('request.jwt.claim.sub', secretary_id::text, true);
  affected := 0;
  begin
    update public.events set owner_id = member_id where id = event_id;
    get diagnostics affected = row_count;
  exception when others then
    affected := 0;
  end;
  if affected <> 0 then raise exception 'Secretary changed event owner'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  if not exists (select 1 from public.event_process_members m where m.event_id = event_id and m.profile_id = assigned_id) then
    raise exception 'Historical SKS assignment was removed';
  end if;

  -- Inactive memberships/profiles/periods cannot obtain the role permission.
  update public.period_memberships m set is_active = false where m.period_id = period_id and m.profile_id = secretary_id;
  perform set_config('request.jwt.claim.sub', secretary_id::text, true);
  if public.can_manage_event_process(event_id, 'sks') then raise exception 'Inactive membership allowed'; end if;
  update public.period_memberships m set is_active = true where m.period_id = period_id and m.profile_id = secretary_id;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.profiles set is_active = false where id = secretary_id;
  perform set_config('request.jwt.claim.sub', secretary_id::text, true);
  if public.can_manage_event_process(event_id, 'sks') then raise exception 'Inactive profile allowed'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.profiles set is_active = true where id = secretary_id;
  perform set_config('request.jwt.claim.sub', secretary_id::text, true);
  update public.periods set is_active = false where id = period_id;
  if public.can_manage_event_process(event_id, 'sks') then raise exception 'Inactive period allowed'; end if;
  update public.periods set is_active = true, is_locked = true where id = period_id;
  set local role authenticated;
  blocked := false;
  begin
    update public.events set sks_status = 'under_review' where id = event_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'Locked period update allowed'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;
rollback;
