# Mobil Web Push kontrol raporu

## Hazır olanlar

- Kullanıcı ana sayfadan cihaz bildirim aboneliğini açıp kapatabilir.
- Abonelik endpoint ve anahtarları `push_subscriptions` tablosunda tutulur.
- Mevcut `in_app` bildirim kuyruğundan ayrı `push` kuyruğu oluşturulur.
- Service worker gelen bildirimi gösterir ve tıklamada ilgili etkinliğe yönlendirir.
- Eski push aboneliklerinin 404/410 teslim hatasında pasifleştirilmesi kodlandı.
- `deliver-push-notifications` Edge Function Supabase'e deploy edildi.

## Tamamlanan canlı ayarlar

- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ve `PUSH_DISPATCH_SECRET` Supabase Function secret olarak tanımlandı.
- `pg_net` etkinleştirildi; `push_dispatch_secret` Supabase Vault'a yazıldı.
- `deliver-push-notifications-every-minute` adlı Supabase Cron işi Edge Function'a güvenli şekilde çağrı yapacak biçimde kuruldu.
- Public VAPID key, `VITE_WEB_PUSH_PUBLIC_KEY` ortam değişkeni varsa onu; yoksa repodaki public fallback'i kullanıyor. Private key repoya eklenmedi.
- iOS canlı testi HTTPS üzerinde siteyi Ana Ekrana Ekleme ve kullanıcı izin verme adımlarıyla yapılmalı.

Private key, service role key ve gerçek `.env` değerleri repoya eklenmedi.

## Kod kontrolleri

- `npm run lint`: başarılı
- `npm run build`: başarılı
- `git diff --check`: başarılı
