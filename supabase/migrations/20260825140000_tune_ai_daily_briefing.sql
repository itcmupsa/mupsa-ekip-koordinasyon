-- Süper Yönetici günlük özetini gerçek hazırlık dönemine ve ücretsiz kotaya göre sıkılaştırır.

update public.ai_feature_settings settings
set daily_flash_request_cap = 12,
    policy_version = '2026-08-super-admin-daily-briefing-v3',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active
  and settings.free_tier_only;

-- Eski altı kartlık çıktı saklanır ancak yeni politika altında tekrar gösterilmez.
update public.ai_outputs output
set is_current = false
from public.periods period
where period.id = output.period_id
  and period.is_active
  and output.output_type = 'home_summary'
  and output.is_current;
