-- Yeni Google AI Studio anahtarlarında kullanılabilen kararlı ücretsiz-katman modelleri.
-- Ücretli katman veya faturalandırma açmaz; yalnızca model kimliklerini günceller.

update public.ai_feature_settings settings
set flash_model = 'gemini-3.6-flash',
    flash_lite_model = 'gemini-3.5-flash-lite',
    policy_version = '2026-08-super-admin-home-pilot-v2',
    updated_at = now()
from public.periods period
where period.id = settings.period_id
  and period.is_active
  and settings.free_tier_only;
