-- Faz 4 / Ana sayfa AI özeti için yetki filtreli kesin veri bağlamı.
-- Bu RPC model çağrısı yapmaz. Uzun metin, kişi adı, e-posta, bütçe,
-- sponsor, not, rapor veya karar içeriğini bağlama dahil etmez.

create or replace function public.get_my_ai_home_context(target_period_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
  viewer_coordinator_role text;
  report_offset integer;
  result jsonb;
begin
  select membership.app_role, coordinator_role.slug
  into viewer_role, viewer_coordinator_role
  from public.period_memberships membership
  join public.profiles profile
    on profile.id = membership.profile_id
   and profile.is_active
  join public.periods period
    on period.id = membership.period_id
   and period.is_active
  join public.coordinator_roles coordinator_role
    on coordinator_role.id = membership.coordinator_role_id
  where membership.period_id = target_period_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  if viewer_role is null then
    raise exception 'Bu dönem için aktif üyelik bulunamadı.';
  end if;

  if not public.is_ai_enabled(target_period_id) then
    raise exception 'Bu dönem için AI özellikleri kapalı.';
  end if;

  select setting.report_reminder_offset_days
  into report_offset
  from public.ai_feature_settings setting
  where setting.period_id = target_period_id;

  with
  visible_tasks as (
    select
      task.id,
      task.event_id,
      task.awareness_post_id,
      task.title,
      task.progress_status,
      task.priority,
      task.deadline_at,
      assignee.assignment_type,
      case
        when task.event_id is not null then 'event'
        when task.awareness_post_id is not null then 'awareness'
        else 'independent'
      end as context_type
    from public.tasks task
    left join lateral (
      select assignment.id, assignment.assignment_type
      from public.task_assignees assignment
      where assignment.task_id = task.id
        and assignment.profile_id = auth.uid()
      order by case assignment.assignment_type
        when 'primary' then 1
        when 'supporting' then 2
        else 3
      end
      limit 1
    ) assignee on true
    where task.period_id = target_period_id
      and task.deleted_at is null
      and task.activation_status = 'active'
      and task.progress_status not in ('completed', 'cancelled')
      and (viewer_role = 'super_admin' or assignee.id is not null)
    order by (task.deadline_at is null), task.deadline_at, task.created_at
    limit 100
  ),
  relevant_event_ids as (
    select event_record.id
    from public.events event_record
    where event_record.period_id = target_period_id
      and event_record.deleted_at is null
      and (
        viewer_role = 'super_admin'
        or event_record.owner_id = auth.uid()
        or exists (
          select 1 from public.event_members member
          where member.event_id = event_record.id
            and member.profile_id = auth.uid()
        )
        or exists (
          select 1 from public.event_process_members process_member
          where process_member.event_id = event_record.id
            and process_member.profile_id = auth.uid()
        )
        or exists (
          select 1 from visible_tasks task
          where task.event_id = event_record.id
        )
      )
  ),
  visible_events as (
    select
      event_record.id,
      event_record.title,
      event_record.event_status,
      event_record.sks_status,
      event_record.planning_date,
      event_record.preparation_start_date,
      event_record.estimated_date,
      event_record.confirmed_date,
      coalesce(event_record.confirmed_date, event_record.estimated_date) as effective_date,
      case
        when coalesce(event_record.confirmed_date, event_record.estimated_date) is null then 'unscheduled'
        when event_record.preparation_start_date is not null
          and current_date < event_record.preparation_start_date then 'before_preparation'
        when current_date < coalesce(event_record.confirmed_date, event_record.estimated_date) - 10 then 'preparation'
        when current_date < coalesce(event_record.confirmed_date, event_record.estimated_date) then 'final_days'
        when current_date = coalesce(event_record.confirmed_date, event_record.estimated_date) then 'event_day'
        when report_offset is null
          or current_date < coalesce(event_record.confirmed_date, event_record.estimated_date) + report_offset then 'post_event_waiting'
        else 'report_due'
      end as lifecycle_phase,
      array_remove(array[
        case when event_record.confirmed_date is null and event_record.estimated_date is null then 'event_date' end,
        case when nullif(trim(event_record.venue), '') is null then 'venue' end,
        case when event_record.sks_status is null then 'sks_status' end
      ], null) as missing_fields
    from public.events event_record
    join relevant_event_ids relevant on relevant.id = event_record.id
    order by coalesce(event_record.confirmed_date, event_record.estimated_date) nulls last,
      event_record.created_at
    limit 100
  ),
  relevant_awareness_ids as (
    select awareness.id
    from public.awareness_posts awareness
    where awareness.period_id = target_period_id
      and awareness.deleted_at is null
      and (
        viewer_role = 'super_admin'
        or viewer_coordinator_role = 'public-relations-coordinator'
        or awareness.created_by = auth.uid()
        or awareness.design_responsible_id = auth.uid()
        or awareness.press_publication_responsible_id = auth.uid()
        or exists (
          select 1 from visible_tasks task
          where task.awareness_post_id = awareness.id
        )
      )
  ),
  visible_awareness as (
    select
      awareness.id,
      awareness.awareness_name,
      awareness.design_status,
      awareness.announcement_text_status,
      awareness.sharing_status,
      awareness.record_check_status,
      awareness.preparation_start_date,
      awareness.estimated_date,
      awareness.share_date,
      coalesce(awareness.share_date, awareness.estimated_date) as effective_date,
      array_remove(array[
        case when awareness.share_date is null and awareness.estimated_date is null then 'share_date' end,
        case when awareness.design_responsible_id is null then 'design_responsible' end,
        case when awareness.press_publication_responsible_id is null then 'publication_responsible' end
      ], null) as missing_fields
    from public.awareness_posts awareness
    join relevant_awareness_ids relevant on relevant.id = awareness.id
    order by coalesce(awareness.share_date, awareness.estimated_date) nulls last
    limit 100
  ),
  visible_calendar as (
    select entry.id, entry.title, entry.entry_type, entry.start_date, entry.end_date
    from public.calendar_entries entry
    where entry.period_id = target_period_id
      and entry.deleted_at is null
      and coalesce(entry.end_date, entry.start_date) >= current_date
      and entry.start_date <= current_date + 45
    order by entry.start_date, entry.created_at
    limit 50
  )
  select jsonb_build_object(
    'schema_version', 'home-context-v1',
    'generated_at', now(),
    'today', current_date,
    'period_id', target_period_id,
    'viewer', jsonb_build_object(
      'app_role', viewer_role,
      'coordinator_role', viewer_coordinator_role
    ),
    'policy', jsonb_build_object(
      'report_reminder_offset_days', report_offset,
      'causality_requires_explicit_dependency', true,
      'mutations_allowed', false
    ),
    'metrics', jsonb_build_object(
      'open_tasks', (select count(*) from visible_tasks),
      'overdue_tasks', (
        select count(*) from visible_tasks
        where deadline_at is not null and deadline_at < now()
      ),
      'relevant_events', (select count(*) from visible_events),
      'relevant_awareness', (select count(*) from visible_awareness),
      'upcoming_calendar_entries', (select count(*) from visible_calendar)
    ),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_type', 'task',
        'source_id', task.id,
        'title', task.title,
        'context_type', task.context_type,
        'context_id', coalesce(task.event_id, task.awareness_post_id),
        'assignment_type', task.assignment_type,
        'progress_status', task.progress_status,
        'priority', task.priority,
        'deadline_at', task.deadline_at,
        'is_overdue', task.deadline_at is not null and task.deadline_at < now(),
        'route', '/app/gorevler'
      ) order by task.deadline_at nulls last)
      from visible_tasks task
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_type', 'event',
        'source_id', event_record.id,
        'title', event_record.title,
        'event_status', event_record.event_status,
        'sks_status', event_record.sks_status,
        'planning_date', event_record.planning_date,
        'preparation_start_date', event_record.preparation_start_date,
        'estimated_date', event_record.estimated_date,
        'confirmed_date', event_record.confirmed_date,
        'effective_date', event_record.effective_date,
        'days_until_event', event_record.effective_date - current_date,
        'lifecycle_phase', event_record.lifecycle_phase,
        'missing_fields', event_record.missing_fields,
        'route', '/app/etkinlikler/' || event_record.id::text
      ) order by event_record.effective_date nulls last)
      from visible_events event_record
    ), '[]'::jsonb),
    'awareness', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_type', 'awareness',
        'source_id', awareness.id,
        'title', awareness.awareness_name,
        'design_status', awareness.design_status,
        'announcement_text_status', awareness.announcement_text_status,
        'sharing_status', awareness.sharing_status,
        'record_check_status', awareness.record_check_status,
        'preparation_start_date', awareness.preparation_start_date,
        'estimated_date', awareness.estimated_date,
        'share_date', awareness.share_date,
        'effective_date', awareness.effective_date,
        'days_until_share', awareness.effective_date - current_date,
        'missing_fields', awareness.missing_fields,
        'route', '/app/farkindalik'
      ) order by awareness.effective_date nulls last)
      from visible_awareness awareness
    ), '[]'::jsonb),
    'calendar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_type', 'calendar_entry',
        'source_id', entry.id,
        'title', entry.title,
        'entry_type', entry.entry_type,
        'start_date', entry.start_date,
        'end_date', entry.end_date,
        'days_until', entry.start_date - current_date,
        'route', '/app/takvim'
      ) order by entry.start_date)
      from visible_calendar entry
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_my_ai_home_context(uuid) from public;
grant execute on function public.get_my_ai_home_context(uuid) to authenticated;

comment on function public.get_my_ai_home_context(uuid) is
  'AI ana sayfa özeti için çağrı öncesi yetki filtreli, kesin ve düşük riskli bağlam üretir.';
