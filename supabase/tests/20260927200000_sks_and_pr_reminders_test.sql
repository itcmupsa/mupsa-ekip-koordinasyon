begin;

do $$
declare
  test_period uuid := gen_random_uuid();
  user_super uuid := gen_random_uuid();
  user_gensec uuid := gen_random_uuid();
  user_owner uuid := gen_random_uuid();
  user_co_coord uuid := gen_random_uuid();
  user_normal uuid := gen_random_uuid();
  user_other_process uuid := gen_random_uuid();
  
  test_event uuid := gen_random_uuid();
  test_pr uuid := gen_random_uuid();
  test_pr_followup uuid := gen_random_uuid();
  test_awareness uuid := gen_random_uuid();
  test_pr_watermark uuid := gen_random_uuid();
  
  notif_count int;
  affected_rows int;
  
  coord_role_gensec uuid;
  coord_role_normal uuid;
begin
  -- 1) FIXTURES
  
  -- Create period with is_locked=false initially
  insert into public.periods (id, slug, label, starts_on, ends_on, is_active, is_locked)
  values (test_period, '2026-test', 'Test 2026', '2026-01-01', '2026-12-31', true, false);

  -- Roles
  select id into coord_role_gensec from public.coordinator_roles where slug = 'general-secretary' limit 1;
  select id into coord_role_normal from public.coordinator_roles where slug <> 'general-secretary' limit 1;

  -- Create users with full auth.users pattern (trigger creates profiles)
  insert into auth.users (id, email) values (user_super, 'super@test.com');
  insert into auth.users (id, email) values (user_gensec, 'gensec@test.com');
  insert into auth.users (id, email) values (user_owner, 'owner@test.com');
  insert into auth.users (id, email) values (user_co_coord, 'cocoord@test.com');
  insert into auth.users (id, email) values (user_normal, 'normal@test.com');
  insert into auth.users (id, email) values (user_other_process, 'other@test.com');

  -- period_memberships require period_display_name
  insert into public.period_memberships (period_id, profile_id, app_role, coordinator_role_id, period_display_name)
  values
    (test_period, user_super, 'super_admin', coord_role_normal, 'Test 2026'),
    (test_period, user_gensec, 'coordinator', coord_role_gensec, 'Test 2026'),
    (test_period, user_owner, 'coordinator', coord_role_normal, 'Test 2026'),
    (test_period, user_co_coord, 'coordinator', coord_role_normal, 'Test 2026'),
    (test_period, user_normal, 'coordinator', coord_role_normal, 'Test 2026'),
    (test_period, user_other_process, 'coordinator', coord_role_normal, 'Test 2026');

  -- Create test event
  insert into public.events (id, period_id, title, owner_id, event_status, estimated_date, created_by)
  values (test_event, test_period, 'Test Event', user_owner, 'planning', current_date - interval '2 days', user_super);

  insert into public.event_coordinators (event_id, profile_id, added_by)
  values (test_event, user_co_coord, user_super);

  insert into public.event_process_members (event_id, process_type, responsibility_type, profile_id, assigned_by)
  values (test_event, 'press', 'owner', user_other_process, user_super);

  -- Awareness post
  insert into public.awareness_posts (id, period_id, awareness_name, share_date, press_publication_responsible_id, sharing_status, created_by)
  values (
    test_awareness, test_period, 'Awareness', 
    (now() - interval '2 days')::date,
    user_other_process, 'not_shared', user_super
  );

  -- Set scheduler activation watermark backward so our tests pass the activation filter
  insert into public.system_configs (key, value)
  values ('scheduler_activation', to_jsonb(now() - interval '10 years'))
  on conflict (key) do update set value = to_jsonb(now() - interval '10 years');

  -- PR entries
  insert into public.pr_calendar_entries (id, period_id, title, scheduled_date, scheduled_time, created_by, status)
  values (
    test_pr, test_period, 'PR Due', 
    (now() at time zone 'Europe/Istanbul')::date,
    (now() at time zone 'Europe/Istanbul')::time,
    user_super, 'planned'
  );

  insert into public.pr_calendar_entries (id, period_id, title, scheduled_date, scheduled_time, created_by, status)
  values (
    test_pr_followup, test_period, 'PR Followup', 
    ((now() - interval '25 hours') at time zone 'Europe/Istanbul')::date,
    ((now() - interval '25 hours') at time zone 'Europe/Istanbul')::time,
    user_super, 'planned'
  );

  insert into public.pr_calendar_permissions (period_id, profile_id, can_manage)
  values (test_period, user_normal, true);

  -- 2) BACKEND SKS DB STATE ASSERTIONS (RLS + TRIGGER)
  -- Perform while period is UNLOCKED
  -- Initial sks_status is null.
  
  -- A) General Secretary (Positive) -> application_preparing
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', user_gensec::text, true);
  update public.events set sks_status = 'application_preparing' where id = test_event;
  if not exists (select 1 from public.events where id = test_event and sks_status = 'application_preparing') then
    raise exception 'GenSec failed to update SKS status';
  end if;

  -- GenSec Negative (cannot update unrelated field)
  begin
    update public.events set title = 'Hacked Title' where id = test_event;
    get diagnostics affected_rows = row_count;
  exception when others then
    affected_rows := 0;
  end;
  if affected_rows > 0 then
    raise exception 'GenSec wrongly succeeded in updating unrelated fields (title)';
  end if;

  -- B) Event Owner (Positive) -> application_submitted
  perform set_config('request.jwt.claim.sub', user_owner::text, true);
  update public.events set sks_status = 'application_submitted' where id = test_event;
  if not exists (select 1 from public.events where id = test_event and sks_status = 'application_submitted') then
    raise exception 'Owner failed to update SKS status';
  end if;

  -- C) Event Co-coordinator (Positive) -> under_review
  perform set_config('request.jwt.claim.sub', user_co_coord::text, true);
  update public.events set sks_status = 'under_review' where id = test_event;
  if not exists (select 1 from public.events where id = test_event and sks_status = 'under_review') then
    raise exception 'Co-coord failed to update SKS status';
  end if;

  -- D) Super Admin (Positive) -> approved
  perform set_config('request.jwt.claim.sub', user_super::text, true);
  update public.events set sks_status = 'approved' where id = test_event;
  if not exists (select 1 from public.events where id = test_event and sks_status = 'approved') then
    raise exception 'Super Admin failed to update SKS status';
  end if;

  -- E) Normal Member (Negative) -> Try to change to rejected
  perform set_config('request.jwt.claim.sub', user_normal::text, true);
  begin
    update public.events set sks_status = 'rejected' where id = test_event;
    get diagnostics affected_rows = row_count;
  exception when others then
    affected_rows := 0;
  end;
  if affected_rows > 0 then
    raise exception 'Normal member actually changed the SKS status DB state';
  end if;

  -- F) Other Process Owner (Negative) -> Try to change to revision_requested
  perform set_config('request.jwt.claim.sub', user_other_process::text, true);
  begin
    update public.events set sks_status = 'revision_requested' where id = test_event;
    get diagnostics affected_rows = row_count;
  exception when others then
    affected_rows := 0;
  end;
  if affected_rows > 0 then
    raise exception 'Other process owner wrongly succeeded in updating SKS status';
  end if;
  
  -- Final check for event title, owner state, and SKS status remain correct
  if not exists (select 1 from public.events where id = test_event and sks_status = 'approved') then
    raise exception 'SKS state leaked! Expected approved final state from negative tests.';
  end if;

  -- 3) OWNER TRANSFER PROTECTION (Negative)
  perform set_config('request.jwt.claim.sub', user_owner::text, true);
  begin
    update public.events set owner_id = user_normal where id = test_event;
    get diagnostics affected_rows = row_count;
  exception when others then
    affected_rows := 0;
  end;
  if affected_rows > 0 then
    raise exception 'Owner wrongly succeeded in changing owner_id';
  end if;
  
  -- Final check for event title and owner state
  if exists (select 1 from public.events where id = test_event and (title = 'Hacked Title' or owner_id = user_normal)) then
    raise exception 'State leaked! Unrelated fields were unexpectedly updated';
  end if;

  -- Reset role back to root
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  -- 4) LOCK PERIOD
  update public.periods set is_locked = true where id = test_period;

  -- 5) PRIVILEGES
  if has_function_privilege('authenticated', 'public.queue_pr_and_delay_reminders()', 'EXECUTE') then
    raise exception 'Authenticated role has EXECUTE on queue_pr_and_delay_reminders';
  end if;
  if has_function_privilege('anon', 'public.queue_pr_and_delay_reminders()', 'EXECUTE') then
    raise exception 'Anon role has EXECUTE on queue_pr_and_delay_reminders';
  end if;
  if has_table_privilege('authenticated', 'public.system_configs', 'SELECT') then
    raise exception 'Authenticated role has SELECT on system_configs';
  end if;

  -- 6) NOTIFICATIONS / FANOUT
  delete from public.notifications;

  -- Run scheduler while period is locked
  perform public.queue_pr_and_delay_reminders();

  -- PR Due fanout: 6 users
  select count(*) into notif_count from public.notifications where metadata->>'pr_entry_id' = test_pr::text and notification_type = 'pr_due' and channel = 'in_app';
  if notif_count <> 6 then raise exception 'PR due fanout expected 6, got %', notif_count; end if;

  -- PR Followup: only user_normal
  select count(*) into notif_count from public.notifications where metadata->>'pr_entry_id' = test_pr_followup::text and notification_type = 'pr_followup' and channel = 'in_app';
  if notif_count <> 1 then raise exception 'PR followup fanout expected 1, got %', notif_count; end if;
  
  select count(*) into notif_count from public.notifications where metadata->>'pr_entry_id' = test_pr_followup::text and notification_type = 'pr_followup' and recipient_id = user_super and channel = 'in_app';
  if notif_count <> 0 then raise exception 'Super admin received PR followup without explicit permission row'; end if;

  -- Event Delay: owner + cocoord = 2
  select count(*) into notif_count from public.notifications where metadata->>'event_id' = test_event::text and notification_type = 'event_delayed' and channel = 'in_app';
  if notif_count <> 2 then raise exception 'Event delay expected 2, got %', notif_count; end if;

  -- Awareness delay: 1
  select count(*) into notif_count from public.notifications where metadata->>'awareness_post_id' = test_awareness::text and notification_type = 'awareness_delayed' and channel = 'in_app';
  if notif_count <> 1 then raise exception 'Awareness delay expected 1, got %', notif_count; end if;

  -- 7) IDEMPOTENCY
  perform public.queue_pr_and_delay_reminders();
  
  select count(*) into notif_count from public.notifications where metadata->>'pr_entry_id' = test_pr::text and notification_type = 'pr_due' and channel = 'in_app';
  if notif_count <> 6 then raise exception 'Idempotency failed for PR due, got %', notif_count; end if;
  
  -- 8) ACTIVATION WATERMARK / BACKLOG SKIP TEST
  insert into public.system_configs (key, value)
  values ('scheduler_activation', to_jsonb(now() + interval '1 day'))
  on conflict (key) do update set value = to_jsonb(now() + interval '1 day');
  
  -- Unlock momentarily to add a test fixture
  update public.periods set is_locked = false where id = test_period;
  insert into public.pr_calendar_entries (id, period_id, title, scheduled_date, scheduled_time, created_by, status)
  values (
    test_pr_watermark, test_period, 'PR Due Future Watermark', 
    (now() at time zone 'Europe/Istanbul')::date,
    (now() at time zone 'Europe/Istanbul')::time,
    user_super, 'planned'
  );
  update public.periods set is_locked = true where id = test_period;

  perform public.queue_pr_and_delay_reminders();
  
  select count(*) into notif_count from public.notifications where metadata->>'pr_entry_id' = test_pr_watermark::text and notification_type = 'pr_due' and channel = 'in_app';
  if notif_count > 0 then raise exception 'Backlog watermark failed, generated notification for legacy record'; end if;

end $$;

rollback;
