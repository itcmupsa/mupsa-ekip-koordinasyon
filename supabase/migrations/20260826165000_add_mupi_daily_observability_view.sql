-- Hassas prompt/veri tutmadan MUPI gunluk ozet uretimini teshis etmeye yarayan
-- service-role gozlemleme gorunumu.

create or replace view public.mupi_daily_summary_observability
with (security_invoker = true)
as
select
  output.id as output_id,
  output.period_id,
  output.recipient_id,
  output.summary_date,
  output.created_at,
  output.expires_at,
  output.model_id as provider_model,
  output.payload ->> 'generated_by' as generated_by,
  coalesce(jsonb_array_length(output.source_manifest), 0) as source_count,
  coalesce(jsonb_array_length(coalesce(output.payload -> 'today', '[]'::jsonb)), 0) as today_count,
  coalesce(jsonb_array_length(coalesce(output.payload -> 'upcoming', '[]'::jsonb)), 0) as upcoming_count,
  (output.payload ->> 'generated_by' = 'deterministic-v2') as fallback_used,
  output.validation_status,
  output.is_current
from public.ai_outputs output
where output.output_type = 'home_summary'
  and output.payload ->> 'schema_version' = 'mupi-daily-summary-v2';

revoke all on public.mupi_daily_summary_observability from public;
revoke all on public.mupi_daily_summary_observability from authenticated;
grant select on public.mupi_daily_summary_observability to service_role;
