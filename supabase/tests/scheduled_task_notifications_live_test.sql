-- Gercek Supabase SQL Editor testi. Tum kayitlar ROLLBACK ile geri alinir.
begin;

do $$
declare
  owner_id uuid := '11111111-1111-4111-8111-111111111111';
  assignee_id uuid := '22222222-2222-4222-8222-222222222222';
  president_id uuid := '33333333-3333-4333-8333-333333333333';
  admin_id uuid := '44444444-4444-4444-8444-444444444444';
  period_id uuid;
  general_secretary_role_id uuid;
  president_role_id uuid;
  it_role_id uuid;
  event_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  fallback_event_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  overdue_task_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  due_soon_task_id uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  confirmed_date_task_id uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  estimated_date_task_id uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  blocked_date_task_id uuid := '99999999-9999-4999-8999-999999999999';
  overdue_count integer;
  due_soon_count integer;
  activated_count integer;
  cron_count integer;
begin
  insert into auth.users (id, raw_user_meta_data) values
    (owner_id, '{"display_name":"Cron Test Sahibi"}'::jsonb),
    (assignee_id, '{"display_name":"Cron Test Sorumlusu"}'::jsonb),
    (president_id, '{"display_name":"Cron Test Baskani"}'::jsonb),
    (admin_id, '{"display_name":"Cron Test IT"}'::jsonb);

  select id into period_id from public.periods where slug = '2026-2027';
  select id into general_secretary_role_id from public.coordinator_roles where slug = 'general-secretary';
  select id into president_role_id from public.coordinator_roles where slug = 'president';
  select id into it_role_id from public.coordinator_roles where slug = 'information-technologies-coordinator';

  insert into public.period_memberships (period_id, profile_id, coordinator_role_id, app_role) values
    (period_id, owner_id, general_secretary_role_id, 'coordinator'),
    (period_id, assignee_id, general_secretary_role_id, 'coordinator'),
    (period_id, president_id, president_role_id, 'coordinator'),
    (period_id, admin_id, it_role_id, 'super_admin');

  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.events (id, period_id, title, created_by, owner_id, sks_status, event_status)
  values (event_id, period_id, 'Cron test etkinligi', owner_id, owner_id, 'not_required', 'planning');

  insert into public.tasks (id, event_id, title, created_by, activation_status, deadline_at)
  values (overdue_task_id, event_id, 'Gecikmis test gorevi', owner_id, 'active', now() - interval '1 hour');
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (overdue_task_id, assignee_id, 'primary', owner_id);

  perform public.queue_task_overdue_notifications();
  select count(*) into overdue_count from public.notifications
  where task_id = overdue_task_id and notification_type = 'task_overdue';
  if overdue_count <> 8 then
    raise exception 'Ilk gecikme bildirimi beklenen 8 yerine % bulundu', overdue_count;
  end if;

  update public.notifications
  set created_at = now() - interval '25 hours'
  where task_id = overdue_task_id
    and notification_type = 'task_overdue'
    and metadata ->> 'reminder_stage' = 'initial';
  perform public.queue_task_overdue_notifications();
  select count(*) into overdue_count from public.notifications
  where task_id = overdue_task_id and notification_type = 'task_overdue';
  if overdue_count <> 16 then
    raise exception '24 saat sonraki hatirlatma beklenen 16 yerine % bulundu', overdue_count;
  end if;

  update public.tasks set progress_status = 'completed' where id = overdue_task_id;
  perform public.queue_task_overdue_notifications();
  select count(*) into overdue_count from public.notifications
  where task_id = overdue_task_id and notification_type = 'task_overdue';
  if overdue_count <> 16 then
    raise exception 'Tamamlanan gorev icin yeni gecikme bildirimi olustu';
  end if;

  insert into public.tasks (id, event_id, title, created_by, activation_status, deadline_at)
  values (due_soon_task_id, event_id, 'Yaklasan test gorevi', owner_id, 'active', now() + interval '12 hours');
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (due_soon_task_id, assignee_id, 'primary', owner_id);
  perform public.queue_task_due_soon_notifications();
  perform public.queue_task_due_soon_notifications();
  select count(*) into due_soon_count from public.notifications
  where task_id = due_soon_task_id and notification_type = 'task_due_soon';
  if due_soon_count <> 4 then
    raise exception 'Yaklasan tarih bildirimi beklenen 4 yerine % bulundu', due_soon_count;
  end if;

  insert into public.tasks (id, event_id, title, created_by, activation_status)
  values (confirmed_date_task_id, event_id, 'Kesin tarih bagimliligi', owner_id, 'draft');
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (confirmed_date_task_id, assignee_id, 'primary', owner_id);
  update public.events set confirmed_date = current_date where id = event_id;
  insert into public.task_dependencies (task_id, dependency_type, source_event_id, offset_days, created_by)
  values (confirmed_date_task_id, 'event_date_offset', event_id, 0, owner_id);

  insert into public.events (id, period_id, title, created_by, owner_id, sks_status, event_status, estimated_date)
  values (fallback_event_id, period_id, 'Tahmini tarih test etkinligi', owner_id, owner_id, 'not_required', 'planning', current_date);
  insert into public.tasks (id, event_id, title, created_by, activation_status)
  values (estimated_date_task_id, fallback_event_id, 'Tahmini tarih bagimliligi', owner_id, 'draft');
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (estimated_date_task_id, assignee_id, 'primary', owner_id);
  insert into public.task_dependencies (task_id, dependency_type, source_event_id, offset_days, created_by)
  values (estimated_date_task_id, 'event_date_offset', fallback_event_id, 0, owner_id);

  insert into public.tasks (id, event_id, title, created_by, activation_status)
  values (blocked_date_task_id, event_id, 'Ek SKS kosullu tarih bagimliligi', owner_id, 'draft');
  insert into public.task_assignees (task_id, profile_id, assignment_type, assigned_by)
  values (blocked_date_task_id, assignee_id, 'primary', owner_id);
  insert into public.task_dependencies (task_id, dependency_type, source_event_id, offset_days, created_by)
  values (blocked_date_task_id, 'event_date_offset', event_id, 0, owner_id);
  insert into public.task_dependencies (task_id, dependency_type, source_event_id, required_sks_status, created_by)
  values (blocked_date_task_id, 'sks_status', event_id, 'approved', owner_id);

  perform public.activate_ready_date_dependent_tasks();
  select count(*) into activated_count from public.tasks
  where id in (confirmed_date_task_id, estimated_date_task_id) and activation_status = 'active';
  if activated_count <> 2 then
    raise exception 'Tarih bagimliligiyla aktive olan gorev sayisi beklenen 2 yerine % bulundu', activated_count;
  end if;
  if (select activation_status from public.tasks where id = blocked_date_task_id) <> 'draft' then
    raise exception 'Diger SKS kosulu saglanmayan gorev hatali sekilde aktive oldu';
  end if;
  select count(*) into activated_count from public.notifications
  where task_id in (confirmed_date_task_id, estimated_date_task_id)
    and notification_type = 'dependency_activated';
  if activated_count <> 4 then
    raise exception 'Tarih bagimliligi bildirim sayisi beklenen 4 yerine % bulundu', activated_count;
  end if;

  select count(*) into cron_count from cron.job
  where jobname in ('mupsa-task-overdue-scan', 'mupsa-daily-task-and-date-scan');
  if cron_count <> 2 then
    raise exception 'Beklenen 2 pg_cron kaydi yerine % bulundu', cron_count;
  end if;
end;
$$;

rollback;
select 'PASS_SCHEDULED_TASK_NOTIFICATIONS' as result;
