-- Günlük özet için uzun metinleri açmadan, son özetten beri değişen kayıtların
-- güvenli ve yetki filtreli hareket bilgisini döndürür.
create or replace function public.get_my_ai_home_activity(
  target_period_id uuid,
  target_changed_since timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
  changed_since timestamptz := greatest(
    coalesce(target_changed_since, date_trunc('day', now())),
    now() - interval '7 days'
  );
begin
  select membership.app_role into viewer_role
  from public.period_memberships membership
  join public.profiles profile on profile.id = membership.profile_id and profile.is_active
  join public.periods period on period.id = membership.period_id and period.is_active
  where membership.period_id = target_period_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  if viewer_role is null then
    raise exception 'Bu dönem için aktif üyelik bulunamadı.';
  end if;
  if viewer_role <> 'super_admin' then
    raise exception 'AI hareket özeti yalnızca Süper Yöneticiye açıktır.';
  end if;
  if not public.is_ai_enabled(target_period_id) then
    raise exception 'Bu dönem için AI özellikleri kapalı.';
  end if;

  return jsonb_build_object(
    'changed_since', changed_since,
    'items', coalesce((
      select jsonb_agg(activity.item order by activity.changed_at desc)
      from (
        select * from (
        select jsonb_build_object(
          'source_type', 'task', 'source_id', task.id, 'title', task.title,
          'route', '/app/gorevler',
          'activity_kind', case
            when task.progress_status = 'completed' then 'task_completed'
            when task.created_at > changed_since then 'task_created'
            else 'task_updated'
          end,
          'progress_status', task.progress_status, 'priority', task.priority,
          'deadline_at', task.deadline_at, 'created_at', task.created_at,
          'updated_at', task.updated_at
        ) as item, task.updated_at as changed_at
        from public.tasks task
        where task.period_id = target_period_id
          and task.updated_at > changed_since
          and task.deleted_at is null
          and task.activation_status = 'active'

        union all

        select jsonb_build_object(
          'source_type', 'event', 'source_id', event_record.id, 'title', event_record.title,
          'route', '/app/etkinlikler/' || event_record.id::text,
          'activity_kind', case when event_record.created_at > changed_since then 'event_created' else 'event_updated' end,
          'event_status', event_record.event_status,
          'effective_date', coalesce(event_record.confirmed_date, event_record.estimated_date),
          'created_at', event_record.created_at, 'updated_at', event_record.updated_at
        ) as item, event_record.updated_at as changed_at
        from public.events event_record
        where event_record.period_id = target_period_id
          and event_record.updated_at > changed_since
          and event_record.deleted_at is null

        union all

        select jsonb_build_object(
          'source_type', 'awareness', 'source_id', awareness.id, 'title', awareness.awareness_name,
          'route', '/app/farkindalik',
          'activity_kind', case when awareness.created_at > changed_since then 'awareness_created' else 'awareness_updated' end,
          'sharing_status', awareness.sharing_status,
          'effective_date', coalesce(awareness.share_date, awareness.estimated_date),
          'created_at', awareness.created_at, 'updated_at', awareness.updated_at
        ) as item, awareness.updated_at as changed_at
        from public.awareness_posts awareness
        where awareness.period_id = target_period_id
          and awareness.updated_at > changed_since
          and awareness.deleted_at is null

        union all

        select jsonb_build_object(
          'source_type', 'calendar_entry', 'source_id', entry.id, 'title', entry.title,
          'route', '/app/takvim',
          'activity_kind', case when entry.created_at > changed_since then 'calendar_entry_created' else 'calendar_entry_updated' end,
          'entry_type', entry.entry_type, 'start_date', entry.start_date, 'end_date', entry.end_date,
          'created_at', entry.created_at, 'updated_at', entry.updated_at
        ) as item, entry.updated_at as changed_at
        from public.calendar_entries entry
        where entry.period_id = target_period_id
          and entry.updated_at > changed_since
          and entry.deleted_at is null
        ) all_activity
        order by changed_at desc
        limit 30
      ) activity
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_ai_home_activity(uuid, timestamptz) from public;
grant execute on function public.get_my_ai_home_activity(uuid, timestamptz) to authenticated;

comment on function public.get_my_ai_home_activity(uuid, timestamptz) is
  'Son özetten beri değişen görev, etkinlik, farkındalık ve takvim kayıtlarını uzun/gizli metinler olmadan döndürür.';

update public.ai_feature_settings settings
set policy_version = '2026-08-activity-delta-v7', updated_at = now()
from public.periods period
where period.id = settings.period_id and period.is_active;

update public.ai_outputs output
set is_current = false
from public.periods period
where period.id = output.period_id
  and period.is_active
  and output.output_type = 'home_summary'
  and output.is_current;
