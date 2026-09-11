-- Run only after 20260911110000_add_calendar_hub_pr_entries.sql has been
-- concatenated into one BEGIN/ROLLBACK transaction. This file deliberately
-- has no transaction control and leaves no records when the caller rolls back.

create temporary table pr_calendar_test_ids (
  press_id uuid not null,
  member_id uuid not null,
  stale_admin_id uuid not null,
  active_period_id uuid not null,
  inactive_period_id uuid not null,
  central_task_id uuid not null
) on commit drop;

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

create or replace function pg_temp.expect_error(statement text, message text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    return;
  end;
  raise exception 'Expected error: %', message;
end;
$$;

grant select on pr_calendar_test_ids to authenticated;

do $$
declare
  press_user_id uuid := gen_random_uuid();
  member_user_id uuid := gen_random_uuid();
  stale_admin_user_id uuid := gen_random_uuid();
  active_admin_user_id uuid := gen_random_uuid();
  active_period uuid := gen_random_uuid();
  inactive_period uuid := gen_random_uuid();
  press_role_id uuid;
  general_role_id uuid;
  central_task uuid;
  linked_event uuid;
begin
  select id into press_role_id
  from public.coordinator_roles
  where slug = 'press-and-publication-coordinator';
  select id into general_role_id
  from public.coordinator_roles
  where slug = 'general-secretary';
  if press_role_id is null or general_role_id is null then
    raise exception 'Calendar PR test needs seeded coordinator roles.';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (press_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'calendar-pr-press-' || press_user_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"PR test press"}'::jsonb, now(), now()),
    (member_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'calendar-pr-member-' || member_user_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"PR test member"}'::jsonb, now(), now()),
    (active_admin_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'calendar-pr-admin-' || active_admin_user_id || '@example.invalid', 'not-used', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()),
    (stale_admin_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'calendar-pr-stale-' || stale_admin_user_id || '@example.invalid', 'not-used', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"PR test stale admin"}'::jsonb, now(), now());

  insert into public.periods (id, slug, label, is_active, is_locked)
  values
    (active_period, 'calendar-pr-test-active-' || active_period, 'Calendar PR active ' || active_period, true, false),
    (inactive_period, 'calendar-pr-test-inactive-' || inactive_period, 'Calendar PR inactive ' || inactive_period, false, false);

  insert into public.period_memberships (period_id, profile_id, coordinator_role_id, app_role, is_active, period_display_name)
  values
    (active_period, press_user_id, press_role_id, 'coordinator', true, 'Test Basın Yayın'),
    (active_period, member_user_id, general_role_id, 'coordinator', true, 'Test Üye'),
    (active_period, active_admin_user_id, general_role_id, 'super_admin', true, 'Test Yönetici'),
    (inactive_period, stale_admin_user_id, general_role_id, 'super_admin', true, 'Test Eski Yönetici');

  insert into public.tasks (period_id, title, created_by, activation_status, progress_status, deadline_at)
  values (active_period, 'PR calendar central task', press_user_id, 'active', 'not_started', now() + interval '2 days')
  returning id into central_task;
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (central_task, press_user_id, 'supporting', press_user_id);

  insert into public.events (period_id, title, created_by, owner_id, planning_date)
  values (active_period, 'PR calendar historical event', press_user_id, press_user_id, current_date)
  returning id into linked_event;
  insert into public.pr_calendar_entries (period_id, title, scheduled_date, event_id, created_by)
  values (active_period, 'PR calendar historical link', current_date, linked_event, press_user_id);
  perform set_config('request.jwt.claim.sub', active_admin_user_id::text, true);
  update public.events
  set deleted_at = now(), deleted_by = active_admin_user_id
  where id = linked_event;
  -- A historical soft-deleted parent must not prevent later PR status edits or detachment.
  update public.pr_calendar_entries
  set status = 'cancelled'
  where title = 'PR calendar historical link';
  update public.pr_calendar_entries
  set event_id = null
  where title = 'PR calendar historical link';

  insert into pr_calendar_test_ids values (
    press_user_id, member_user_id, stale_admin_user_id, active_period, inactive_period, central_task
  );
end;
$$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

select pg_temp.assert_true(
  public.can_manage_pr_calendar(active_period_id),
  'press-and-publication coordinator manages the active target period'
) from pr_calendar_test_ids;

select pg_temp.assert_true(
  exists (
    select 1
    from public.get_my_calendar_task_deadlines_v2(active_period_id) deadline
    where deadline.id = central_task_id
      and deadline.event_id is null
      and deadline.awareness_post_id is null
  ),
  'v2 calendar RPC includes an active supporting central task'
) from pr_calendar_test_ids;

insert into public.pr_calendar_entries (
  period_id, title, entry_kind, scheduled_date, color, task_id, created_by, notes, reference_url
)
select active_period_id, 'PR calendar behavioral entry', 'publication', current_date,
  '#123abc', central_task_id, press_id, 'do not audit this note', 'https://example.invalid/private'
from pr_calendar_test_ids;

select pg_temp.assert_true(
  exists (
    select 1 from public.pr_calendar_entries
    where title = 'PR calendar behavioral entry'
  ),
  'manager can insert through RLS'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.audit_logs audit
    where audit.entity_type = 'pr_calendar_entry'
      and (audit.after_data ? 'notes' or audit.after_data ? 'reference_url')
  ),
  'PR audit whitelist omits notes and URLs'
);

select pg_temp.expect_error('update public.pr_calendar_entries set id = gen_random_uuid() where title = ''PR calendar behavioral entry''', 'identity is immutable');
select public.set_pr_calendar_entry_inactive(id, true) from public.pr_calendar_entries where title = 'PR calendar behavioral entry';
select pg_temp.assert_true(not exists(select 1 from public.pr_calendar_entries where title = 'PR calendar behavioral entry'), 'coordinator soft-delete hides the row');
reset role;
update public.pr_calendar_entries set deleted_at = null, deleted_by = null where title = 'PR calendar behavioral entry';
set local role authenticated;

reset role;
select set_config('request.jwt.claim.sub', member_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

select pg_temp.assert_true(
  not public.can_manage_pr_calendar(active_period_id),
  'unprivileged active member cannot manage PR calendar'
) from pr_calendar_test_ids;

select pg_temp.expect_error(
  format(
    'insert into public.pr_calendar_entries (period_id, title, scheduled_date, created_by) values (%L::uuid, %L, current_date, %L::uuid)',
    active_period_id, 'unprivileged PR write', member_id
  ),
  'unprivileged direct insert is rejected by RLS'
) from pr_calendar_test_ids;

select pg_temp.assert_true(
  exists (
    select 1 from public.pr_calendar_entries where title = 'PR calendar behavioral entry'
  ),
  'active target-period member can read active PR rows'
);

reset role;
select set_config('request.jwt.claim.sub', stale_admin_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

select pg_temp.assert_true(
  not public.can_manage_pr_calendar(active_period_id),
  'super admin membership in an inactive/other period grants no target-period privilege'
) from pr_calendar_test_ids;

reset role;
do $$
declare
  target_period uuid;
  creator uuid;
begin
  select active_period_id, press_id into target_period, creator from pr_calendar_test_ids;
  begin
    insert into public.calendar_entries (period_id, title, entry_type, start_date, created_by, calendar_scopes)
    values (target_period, 'invalid scope', 'other', current_date, creator, array['events', 'events']);
    raise exception 'invalid scope unexpectedly inserted';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.pr_calendar_entries (period_id, title, scheduled_date, color, created_by)
    values (target_period, 'invalid colour', current_date, '#bad', creator);
    raise exception 'invalid colour unexpectedly inserted';
  exception when check_violation then
    null;
  end;
end;
$$;

select pg_temp.assert_true(not has_table_privilege('anon', 'public.pr_calendar_entries', 'SELECT'), 'anonymous read denied');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'public.pr_calendar_entries', 'DELETE'), 'permanent client delete denied');
update public.periods set is_locked = true where id in (select active_period_id from pr_calendar_test_ids);
select pg_temp.expect_error('update public.pr_calendar_entries set status = ''completed'' where title = ''PR calendar behavioral entry''', 'locked period rejects writes');
