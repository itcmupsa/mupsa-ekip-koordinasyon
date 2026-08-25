-- Yeni kalıcı özet akışı canlıya çıktıktan sonra ilk 3.5 Flash Lite özetini üretir.
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
