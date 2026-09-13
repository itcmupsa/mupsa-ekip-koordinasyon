-- Supabase'in varsayılan fonksiyon yetkileri anon/authenticated rollerine açık
-- EXECUTE verebilir. Sürüm duyurusu yalnız güvenilir service_role tarafından başlatılır.

revoke all on function public.queue_theme_release_announcement(uuid) from public, anon, authenticated;
grant execute on function public.queue_theme_release_announcement(uuid) to service_role;
