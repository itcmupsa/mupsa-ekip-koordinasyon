-- MUPI v2 context duzeltmeleri:
-- - Etkinlikte 'not_required' tasarim/duyuru durumu eksik sayilmaz.
-- - Zaten paylasilmis farkindaliklar gunluk aksiyon adayindan cikarilir.

create or replace function public.get_my_mupi_daily_context(target_period_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_context jsonb;
  enriched_events jsonb;
  filtered_awareness jsonb;
  tr_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  base_context := public.get_my_ai_home_context(target_period_id);

  select coalesce(jsonb_agg(
    event_item
    || jsonb_build_object(
      'effective_date', coalesce(event_record.confirmed_date, event_record.estimated_date),
      'days_until_event', coalesce(event_record.confirmed_date, event_record.estimated_date) - tr_today,
      'design_announcement_status', case
        when event_record.design_announcement_status = 'not_required' then 'ready'
        else event_record.design_announcement_status
      end,
      'report_status', event_record.report_status
    )
    order by coalesce(event_record.confirmed_date, event_record.estimated_date) nulls last
  ), '[]'::jsonb)
  into enriched_events
  from jsonb_array_elements(coalesce(base_context->'events', '[]'::jsonb)) event_item
  join public.events event_record
    on event_record.id = (event_item->>'source_id')::uuid
   and event_record.period_id = target_period_id
   and event_record.deleted_at is null;

  select coalesce(jsonb_agg(awareness_item order by awareness_item->>'effective_date'), '[]'::jsonb)
  into filtered_awareness
  from jsonb_array_elements(coalesce(base_context->'awareness', '[]'::jsonb)) awareness_item
  where coalesce(awareness_item->>'sharing_status', '') <> 'shared';

  return base_context
    || jsonb_build_object(
      'schema_version', 'mupi-daily-context-v2',
      'today', tr_today,
      'events', enriched_events,
      'awareness', filtered_awareness,
      'policy', coalesce(base_context->'policy', '{}'::jsonb) || jsonb_build_object(
        'summary_timezone', 'Europe/Istanbul',
        'selection_engine', 'deterministic-v2',
        'max_today_items', 3,
        'max_upcoming_items', 3
      )
    );
end;
$$;

revoke all on function public.get_my_mupi_daily_context(uuid) from public;
grant execute on function public.get_my_mupi_daily_context(uuid) to authenticated;
