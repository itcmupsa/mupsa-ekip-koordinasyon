-- Kullanıcıya görünen AI marka adını mevcut bildirimlerde de Mupi yapar.
update public.notifications
set title = 'Mupi içerik önerisi'
where notification_type = 'awareness_ai_suggestion'
  and title is distinct from 'Mupi içerik önerisi';

-- Yüklemede kalan önceki denemenin yerine zaman aşımı korumalı özeti hemen üretir.
select net.http_post(
  url := 'https://ykcpiihjcvpotvqmzecb.supabase.co/functions/v1/ai-orchestrator',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-dispatch-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'push_dispatch_secret'
    )
  ),
  body := '{"operation":"scheduled_daily_summary"}'::jsonb
);
