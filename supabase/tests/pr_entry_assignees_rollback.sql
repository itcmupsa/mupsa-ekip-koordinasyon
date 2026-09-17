-- Run after 20260917143000_add_pr_entry_assignees.sql inside a rollback transaction.

reset role;
update public.periods set is_locked = false where id in (select active_period_id from pr_calendar_test_ids);

alter table public.events disable trigger audit_events;
alter table public.awareness_posts disable trigger audit_awareness_posts;

create temporary table pr_assignee_test_ids (
  event_owner_id uuid not null,
  awareness_owner_id uuid not null,
  assigned_member_id uuid not null,
  unassigned_member_id uuid not null,
  event_id uuid not null,
  awareness_id uuid not null,
  event_entry_id uuid not null,
  awareness_entry_id uuid not null,
  task_entry_id uuid not null
) on commit drop;

grant select on pr_assignee_test_ids to authenticated;

do $$
declare
  target_period uuid;
  creator uuid;
  general_role_id uuid;
  event_owner uuid := gen_random_uuid();
  awareness_owner uuid := gen_random_uuid();
  assigned_member uuid := gen_random_uuid();
  unassigned_member uuid := gen_random_uuid();
  linked_event uuid;
  linked_awareness uuid;
  event_entry uuid;
  awareness_entry uuid;
  task_entry uuid;
begin
  select active_period_id, press_id into target_period, creator from pr_calendar_test_ids;
  select id into general_role_id from public.coordinator_roles where slug = 'general-secretary';
  if target_period is null or creator is null or general_role_id is null then
    raise exception 'PR assignee tests need predeploy fixtures.';
  end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (event_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pr-event-owner-' || event_owner || '@example.invalid', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (awareness_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pr-awareness-owner-' || awareness_owner || '@example.invalid', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (assigned_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pr-assigned-' || assigned_member || '@example.invalid', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (unassigned_member, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pr-unassigned-' || unassigned_member || '@example.invalid', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.period_memberships (period_id, profile_id, coordinator_role_id, app_role, is_active, period_display_name)
  values
    (target_period, event_owner, general_role_id, 'coordinator', true, 'PR Event Owner'),
    (target_period, awareness_owner, general_role_id, 'coordinator', true, 'PR Awareness Owner'),
    (target_period, assigned_member, general_role_id, 'coordinator', true, 'PR Assigned Member'),
    (target_period, unassigned_member, general_role_id, 'coordinator', true, 'PR Unassigned Member');

  insert into public.events (period_id, title, created_by, owner_id, planning_date)
  values (target_period, 'PR assignee linked event', creator, event_owner, current_date)
  returning id into linked_event;

  insert into public.awareness_posts (period_id, awareness_name, share_date, press_publication_responsible_id, created_by)
  values (target_period, 'PR assignee linked awareness', current_date, awareness_owner, creator)
  returning id into linked_awareness;

  insert into public.pr_calendar_entries (period_id, title, scheduled_date, event_id, created_by)
  values (target_period, 'PR event auto assignee entry', current_date, linked_event, creator)
  returning id into event_entry;

  insert into public.pr_calendar_entries (period_id, title, scheduled_date, awareness_post_id, created_by)
  values (target_period, 'PR awareness auto assignee entry', current_date, linked_awareness, creator)
  returning id into awareness_entry;

  insert into public.pr_calendar_entries (period_id, title, scheduled_date, task_id, created_by)
  select target_period, 'PR task no auto assignee entry', current_date, central_task_id, creator
  from pr_calendar_test_ids
  returning id into task_entry;

  insert into pr_assignee_test_ids values (event_owner, awareness_owner, assigned_member, unassigned_member, linked_event, linked_awareness, event_entry, awareness_entry, task_entry);
end;
$$;

alter table public.events enable trigger audit_events;
alter table public.awareness_posts enable trigger audit_awareness_posts;

select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.event_entry_id = a.pr_entry_id where a.profile_id = t.event_owner_id and a.assignment_source = 'event_owner'),
  'event owner is added as automatic PR assignee'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.pr_calendar_entry_assignees a
    join pr_calendar_test_ids t on a.profile_id = t.member_id
    where a.assignment_source = 'manual'
      and a.pr_entry_id = (select id from public.pr_calendar_entries where title = 'PR calendar behavioral entry')
  ),
  'legacy responsible_id is backfilled as manual assignee'
);

select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.awareness_entry_id = a.pr_entry_id where a.profile_id = t.awareness_owner_id and a.assignment_source = 'awareness_responsible'),
  'awareness PR responsible is added as automatic PR assignee'
);

select pg_temp.assert_true(
  not exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.task_entry_id = a.pr_entry_id),
  'task links do not create automatic PR assignees'
);

reset role;
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;
insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source)
select event_entry_id, event_owner_id, 'manual' from pr_assignee_test_ids;
select pg_temp.assert_true(
  (select count(*) from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.event_entry_id = a.pr_entry_id and a.profile_id = t.event_owner_id) = 2,
  'manual and automatic sources can coexist for the same person without duplicate same-source rows'
);

reset role;
select set_config('request.jwt.claim.sub', event_owner_id::text, true) from pr_assignee_test_ids;
set local role authenticated;

update public.pr_calendar_entries set title = title where id in (select event_entry_id from pr_assignee_test_ids);
select pg_temp.assert_true(true, 'no-op update succeeds without error for assigned member');

do $$
declare
  v_entry_id uuid;
  v_initial_created_at timestamptz;
  v_after_created_at timestamptz;
  v_initial_audit_count int;
  v_after_audit_count int;
begin
  select event_entry_id into v_entry_id from pr_assignee_test_ids;

  select created_at into v_initial_created_at
  from public.pr_calendar_entry_assignees
  where pr_entry_id = v_entry_id and assignment_source = 'event_owner';

  select count(*) into v_initial_audit_count
  from public.audit_logs
  where entity_type = 'pr_calendar_entry_assignee' and entity_id = v_entry_id;

  update public.pr_calendar_entries set title = 'Updated Title Idempotency' where id = v_entry_id;

  select created_at into v_after_created_at
  from public.pr_calendar_entry_assignees
  where pr_entry_id = v_entry_id and assignment_source = 'event_owner';

  select count(*) into v_after_audit_count
  from public.audit_logs
  where entity_type = 'pr_calendar_entry_assignee' and entity_id = v_entry_id;

  if v_initial_created_at is distinct from v_after_created_at then
    raise exception 'created_at should not change on non-owner update';
  end if;

  if v_initial_audit_count != v_after_audit_count then
    raise exception 'Unnecessary audit logs created during idempotent update';
  end if;
end;
$$;
select pg_temp.assert_true(true, 'idempotent update maintains created_at and does not create audit spam');


update public.pr_calendar_entries
set notes = 'assigned member may update operational content', status = 'planned'
where id in (select event_entry_id from pr_assignee_test_ids);
select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entries e join pr_assignee_test_ids t on t.event_entry_id = e.id where e.notes = 'assigned member may update operational content' and e.status = 'planned'),
  'assigned member can update operational PR fields'
);
select pg_temp.expect_error(
  'update public.pr_calendar_entries set deleted_at = now(), deleted_by = auth.uid() where id in (select event_entry_id from pr_assignee_test_ids)',
  'assigned member cannot soft-delete PR row'
);
select pg_temp.expect_error(
  'update public.pr_calendar_entries set event_id = null where id in (select event_entry_id from pr_assignee_test_ids)',
  'assigned member cannot detach linked event'
);
select pg_temp.expect_error(
  'insert into public.pr_calendar_entries (period_id, title, scheduled_date, created_by) select active_period_id, ''assigned direct insert'', current_date, event_owner_id from pr_calendar_test_ids, pr_assignee_test_ids',
  'assigned member cannot create PR row'
);
select pg_temp.expect_error(
  'insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source) select event_entry_id, unassigned_member_id, ''manual'' from pr_assignee_test_ids',
  'assigned member cannot change assignee list'
);

reset role;
select set_config('request.jwt.claim.sub', unassigned_member_id::text, true) from pr_assignee_test_ids;
set local role authenticated;
select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entries where id in (select event_entry_id from pr_assignee_test_ids)),
  'unassigned active member can still read active PR rows'
);
update public.pr_calendar_entries set notes = 'unassigned edit' where id in (select event_entry_id from pr_assignee_test_ids);
select pg_temp.assert_true(
  not exists (select 1 from public.pr_calendar_entries where id in (select event_entry_id from pr_assignee_test_ids) and notes = 'unassigned edit'),
  'unassigned active member cannot update PR row'
);

reset role;
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;
update public.pr_calendar_entries set event_id = null where id in (select event_entry_id from pr_assignee_test_ids);
select pg_temp.assert_true(
  not exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.event_entry_id = a.pr_entry_id where a.assignment_source = 'event_owner'),
  'removing event link removes automatic event assignee'
);
select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.event_entry_id = a.pr_entry_id where a.profile_id = t.event_owner_id and a.assignment_source = 'manual'),
  'manual assignment remains after automatic event assignment is removed'
);

reset role;
update public.periods set is_locked = true where id in (select active_period_id from pr_calendar_test_ids);
select pg_temp.expect_error(
  'insert into public.pr_calendar_entry_assignees (pr_entry_id, profile_id, assignment_source) select awareness_entry_id, assigned_member_id, ''manual'' from pr_assignee_test_ids',
  'locked period rejects PR assignee changes'
);

select pg_temp.expect_error(
  'delete from public.pr_calendar_entry_assignees where pr_entry_id in (select event_entry_id from pr_assignee_test_ids)',
  'locked period rejects PR assignee deletion'
);

reset role;
update public.periods set is_locked = false where id in (select active_period_id from pr_calendar_test_ids);

select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

update public.pr_calendar_entry_assignees set profile_id = (select unassigned_member_id from pr_assignee_test_ids) where assignment_source = 'awareness_responsible';

select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.awareness_entry_id = a.pr_entry_id where a.profile_id = t.awareness_owner_id and a.assignment_source = 'awareness_responsible'),
  'manager cannot update automatic assignment_source rows'
);
reset role;
update public.pr_calendar_entries set event_id = (select event_id from pr_assignee_test_ids) where id in (select event_entry_id from pr_assignee_test_ids);

select set_config('request.jwt.claim.sub', (
  select m.profile_id::text
  from public.period_memberships m
  join pr_calendar_test_ids t on m.period_id = t.active_period_id
  where m.app_role = 'super_admin'
  order by m.profile_id
  limit 1
), true);
set local role authenticated;

update public.events set owner_id = (select unassigned_member_id from pr_assignee_test_ids) where id = (select event_id from pr_assignee_test_ids);

select pg_temp.assert_true(
  exists (select 1 from public.pr_calendar_entry_assignees a join pr_assignee_test_ids t on t.event_entry_id = a.pr_entry_id where a.profile_id = t.unassigned_member_id and a.assignment_source = 'event_owner'),
  'event owner change syncs new owner as auto assignee'
);

reset role;
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

select pg_temp.assert_true(
  exists (select 1 from public.audit_logs a join pr_assignee_test_ids t on t.event_entry_id = a.entity_id where a.entity_type = 'pr_calendar_entry_assignee' and a.action = 'created' and a.after_data->>'assignment_source' = 'manual'),
  'audit log created for assignee insert'
);

update public.pr_calendar_entry_assignees set updated_at = now() where pr_entry_id = (select event_entry_id from pr_assignee_test_ids) and assignment_source = 'manual';

select pg_temp.assert_true(
  exists (select 1 from public.audit_logs a join pr_assignee_test_ids t on t.event_entry_id = a.entity_id where a.entity_type = 'pr_calendar_entry_assignee' and a.action = 'updated' and a.after_data->>'assignment_source' = 'manual'),
  'audit log created for assignee update'
);

delete from public.pr_calendar_entry_assignees where pr_entry_id = (select event_entry_id from pr_assignee_test_ids) and assignment_source = 'manual';

select pg_temp.assert_true(
  exists (select 1 from public.audit_logs a join pr_assignee_test_ids t on t.event_entry_id = a.entity_id where a.entity_type = 'pr_calendar_entry_assignee' and a.action = 'deleted' and a.before_data->>'assignment_source' = 'manual'),
  'audit log created for assignee delete'
);
reset role;

delete from public.pr_calendar_entries where id in (select awareness_entry_id from pr_assignee_test_ids);
select pg_temp.assert_true(
  not exists (select 1 from public.pr_calendar_entry_assignees where pr_entry_id in (select awareness_entry_id from pr_assignee_test_ids)),
  'cascade delete works without transaction error when parent PR entry is deleted'
);

-- Verify transaction rollback behavior for upsert_pr_entry_with_manual_assignees
reset role;
select set_config('request.jwt.claim.sub', press_id::text, true) from pr_calendar_test_ids;
set local role authenticated;

do $$
declare
  v_test_period uuid;
  v_dummy_invalid uuid := gen_random_uuid();
  v_entry_count int;
  v_assignee_count int;
begin
  select active_period_id into v_test_period from pr_calendar_test_ids;

  select count(*) into v_entry_count from public.pr_calendar_entries;
  select count(*) into v_assignee_count from public.pr_calendar_entry_assignees;

  -- Create attempt with invalid assignee
  declare
    v_failed boolean := false;
  begin
    begin
      perform public.upsert_pr_entry_with_manual_assignees(
        null, v_test_period, 'Rollback Create Test', 'other', current_date, null,
        '#000000', 'draft', array[]::text[], null, null, null, null, null, null, null, null,
        '[]'::jsonb, null, null, array[v_dummy_invalid]
      );
    exception when others then
      v_failed := true;
    end;

    if not v_failed then
      raise exception 'Should have failed on invalid assignee during create';
    end if;
  end;

  if (select count(*) from public.pr_calendar_entries) != v_entry_count then
    raise exception 'Entry was not rolled back on create failure';
  end if;

  if (select count(*) from public.pr_calendar_entry_assignees) != v_assignee_count then
    raise exception 'Assignee was not rolled back on create failure';
  end if;

  -- Update attempt with invalid assignee
  declare
    v_existing_entry uuid;
    v_failed boolean := false;
  begin
    select event_entry_id into v_existing_entry from pr_assignee_test_ids;

    begin
      perform public.upsert_pr_entry_with_manual_assignees(
        v_existing_entry, v_test_period, 'Rollback Update Test', 'other', current_date, null,
        '#000000', 'draft', array[]::text[], null, null, null, null, null, null, null, null,
        '[]'::jsonb, null, null, array[v_dummy_invalid]
      );
    exception when others then
      v_failed := true;
    end;

    if not v_failed then
      raise exception 'Should have failed on invalid assignee during update';
    end if;

    if exists (select 1 from public.pr_calendar_entries where id = v_existing_entry and title = 'Rollback Update Test') then
      raise exception 'Entry title was not rolled back on update failure';
    end if;

    if (select count(*) from public.pr_calendar_entry_assignees) != v_assignee_count then
      raise exception 'Assignee was not rolled back on update failure';
    end if;
  end;

  -- Update attempt with NULL p_manual_assignees
  declare
    v_existing_entry uuid;
  begin
    select event_entry_id into v_existing_entry from pr_assignee_test_ids;

    perform public.upsert_pr_entry_with_manual_assignees(
      v_existing_entry, v_test_period, 'Test NULL assignees', 'other', current_date, null,
      '#000000', 'draft', array[]::text[], null, null, null, null, null, null, null, null,
      '[]'::jsonb, null, null, null
    );

    if exists (select 1 from public.pr_calendar_entry_assignees where pr_entry_id = v_existing_entry and assignment_source = 'manual') then
      raise exception 'Manual assignees were not cleared on NULL parameter';
    end if;
  end;

  -- Update attempt with empty array p_manual_assignees
  declare
    v_existing_entry uuid;
  begin
    select event_entry_id into v_existing_entry from pr_assignee_test_ids;

    perform public.upsert_pr_entry_with_manual_assignees(
      v_existing_entry, v_test_period, 'Test empty assignees', 'other', current_date, null,
      '#000000', 'draft', array[]::text[], null, null, null, null, null, null, null, null,
      '[]'::jsonb, null, null, array[]::uuid[]
    );

    if exists (select 1 from public.pr_calendar_entry_assignees where pr_entry_id = v_existing_entry and assignment_source = 'manual') then
      raise exception 'Manual assignees were not cleared on empty array parameter';
    end if;
  end;

end;
$$;

select pg_temp.assert_true(true, 'transaction fully rolls back PR entry and assignees on error in RPC');
