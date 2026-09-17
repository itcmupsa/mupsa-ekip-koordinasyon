-- Run after 20260917100000_add_explicit_pr_calendar_permissions.sql inside a
-- surrounding BEGIN/ROLLBACK transaction.

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  exists (
    select 1
    from public.period_memberships membership
    join public.coordinator_roles role_record on role_record.id = membership.coordinator_role_id
    where membership.id = '41a65f87-cd23-4746-a647-0fc87543ee28'
      and role_record.slug = 'press-and-publication-coordinator'
  ),
  'Beyza coordinator role remains unchanged'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.period_memberships membership
    join public.coordinator_roles role_record on role_record.id = membership.coordinator_role_id
    where membership.id = '74547c6e-1ec4-41da-a918-09d38fd044ff'
      and role_record.slug = 'public-relations-coordinator'
  ),
  'Ezgi coordinator role remains unchanged'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.pr_calendar_permissions', 'SELECT'),
  'authenticated clients cannot read the internal permission table directly'
);

select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.can_manage_pr_calendar(uuid)', 'EXECUTE'),
  'authenticated clients retain access to the permission-check function'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'dafab458-e2bc-4120-a5eb-6928d81e1e1d', true);
set local role authenticated;
select pg_temp.assert_true(
  not public.can_manage_pr_calendar((select id from public.periods where is_active order by created_at desc limit 1)),
  'Beyza no longer manages the PR calendar'
);

reset role;
select set_config('request.jwt.claim.sub', '2f794947-05fb-49d1-8db9-4ff62db564c9', true);
set local role authenticated;
select pg_temp.assert_true(
  public.can_manage_pr_calendar((select id from public.periods where is_active order by created_at desc limit 1)),
  'Ezgi manages the PR calendar'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  (
    select membership.profile_id::text
    from public.period_memberships membership
    join public.periods period_record on period_record.id = membership.period_id and period_record.is_active
    where membership.is_active and membership.app_role = 'super_admin'
    order by membership.created_at
    limit 1
  ),
  true
);
set local role authenticated;
select pg_temp.assert_true(
  public.can_manage_pr_calendar((select id from public.periods where is_active order by created_at desc limit 1)),
  'active super admins retain PR calendar management'
);

reset role;
