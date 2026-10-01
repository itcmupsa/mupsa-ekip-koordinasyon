begin;
do $$
declare
  target_period uuid;
  caller uuid;
  expected_count integer;
  actual_count integer;
begin
  select pm.period_id, pm.profile_id into target_period, caller
  from public.period_memberships pm
  join public.periods p on p.id = pm.period_id and p.is_active
  join public.profiles profile on profile.id = pm.profile_id and profile.is_active
  where pm.is_active limit 1;
  if caller is null then raise exception 'Active member fixture unavailable'; end if;
  select count(*) into expected_count from public.pr_calendar_permissions perm
    join public.period_memberships pm on pm.period_id = perm.period_id and pm.profile_id = perm.profile_id
    join public.profiles profile on profile.id = pm.profile_id
    where perm.period_id = target_period and perm.can_manage and pm.is_active and profile.is_active;
  perform set_config('request.jwt.claim.sub', caller::text, true);
  set local role authenticated;
  select count(*) into actual_count from public.get_pr_publication_managers(target_period);
  if actual_count <> expected_count then raise exception 'Manager display mismatch'; end if;
  if has_table_privilege('authenticated', 'public.pr_calendar_permissions', 'SELECT') then
    raise exception 'Internal permission table exposed';
  end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  if exists (select 1 from public.get_pr_publication_managers(target_period)) then
    raise exception 'Unauthorized caller can read managers';
  end if;
  reset role;
  if has_function_privilege('anon', 'public.get_pr_publication_managers(uuid)', 'EXECUTE') then
    raise exception 'Anonymous execution exposed';
  end if;
end;
$$;
rollback;
