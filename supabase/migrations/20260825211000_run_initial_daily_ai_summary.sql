-- Zamanlayıcı kurulumu sonrasındaki ilk tam günlük özeti hemen üretir.
-- Sonraki çalıştırmalar 09:00 cron görevi tarafından yapılır.
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
