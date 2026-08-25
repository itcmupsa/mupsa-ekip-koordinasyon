-- Faz 4 / Süper Yönetici ana sayfa AI pilotunu düşük ücretsiz-katman kotalarıyla açar.
-- Edge Function ayrıca rolü super_admin ile sınırlar; diğer roller Gemini çağrısı yapamaz.

update public.ai_feature_settings settings
set is_enabled = true,
    free_tier_only = true,
    daily_flash_request_cap = 20,
    daily_flash_lite_request_cap = 100,
    daily_embedding_request_cap = 100,
    per_user_chat_daily_cap = 0,
    per_user_draft_daily_cap = 0,
    policy_version = '2026-08-super-admin-home-pilot-v1',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active;
