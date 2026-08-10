-- Ana sorumlu ve destekleyen kişiler görev son tarihini takvimde görebilir.
-- Bilgilendirilen ve atanmamış kullanıcıların takvim görünürlüğü yoktur.
create or replace function public.get_my_calendar_task_deadlines(target_period_id uuid)
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  title text,
  deadline_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    task.id,
    task.event_id,
    event_record.title as event_title,
    task.title,
    task.deadline_at
  from public.tasks task
  join public.events event_record on event_record.id = task.event_id
  join public.task_assignees assignee on assignee.task_id = task.id
  where assignee.profile_id = auth.uid()
    and assignee.assignment_type in ('primary', 'supporting')
    and event_record.period_id = target_period_id
    and event_record.deleted_at is null
    and task.activation_status = 'active'
    and task.progress_status not in ('completed', 'cancelled')
    and task.deleted_at is null
    and task.deadline_at is not null
    and exists (
      select 1
      from public.period_memberships membership
      where membership.period_id = target_period_id
        and membership.profile_id = auth.uid()
        and membership.is_active
    )
  order by task.deadline_at asc;
$$;

revoke all on function public.get_my_calendar_task_deadlines(uuid) from public;
grant execute on function public.get_my_calendar_task_deadlines(uuid) to authenticated;
