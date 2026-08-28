# MUPSA PWA/Web Push güvenilirlik ve güvenlik düzeltmesi

## Hedef
7+ gün uygulama açılmasa da sunucu tarafı push teslimini dayanıklı, çoklu cihaz güvenli ve tekrar denemeli hale getirmek; logout/RLS/VAPID/SW/payload risklerini azaltmak.

## Durum
Tamamlandı. Supabase migration uygulandı, `deliver-push-notifications` Edge Function yayına alındı, Git commit/push tamamlandı ve Vercel canlı adresi 200/login ekranıyla doğrulandı.

## Uygulanan kararlar
- Push provider kabulü için TTL explicit 28 gün (`2419200` sn).
- Transient provider/network retry dizisi: 1 dk, 5 dk, 15 dk, 1 sa, 6 sa, 24 sa, 48 sa, 96 sa, 7 gün.
- Notification + subscription bazlı `push_notification_deliveries` modeli eklendi.
- `claim_push_notification_deliveries` RPC, `FOR UPDATE SKIP LOCKED`, claim token ve 10 dk stale-processing recovery kullanıyor.
- Aynı kullanıcının bir cihazı başarılı diğer cihazı transient ise notification `queued` kalıyor; cihaz retry kaybolmuyor.
- 404/410 subscription pasifleştiriliyor ve retry edilmiyor.
- Logout'ta eski profile bağlı DB endpoint satırı silinmeye çalışılıyor ve browser subscription iptal ediliyor; normal logout olmayan uzun kapalı kullanımda aboneliğe dokunulmuyor.
- Bildirim izni granted ise ve kullanıcı açıkça opt-out yapmadıysa eksik browser subscription app açılışında sessizce yeniden kurulabiliyor.
- `pushsubscriptionchange` best-effort SW resubscribe + açık client sync mesajı eklendi; kapalı sayfada authenticated server sync garantisi verilmedi.
- `notifications` istemci UPDATE yetkisi yalnız `read_at` kolonuna indirildi.
- Süper Yönetici başka kullanıcıların ham push endpoint/p256dh/auth verisini SELECT edemiyor; service role teslimatı sürüyor.
- Frontend hardcoded VAPID fallback kaldırıldı; `VITE_WEB_PUSH_PUBLIC_KEY` env zorunlu hale geldi.
- SW notification click yalnız same-origin `/app` veya `/app/...` hedefini kabul ediyor.
- Push JSON UTF-8 byte boyutu 3000 byte güvenli sınırında tutuluyor; uzun Unicode gövde yalnız push için kısaltılıyor, uygulama içi body tam kalıyor.
- Mevcut hardcoded production cron/function URL risksiz ortam kaynağı doğrulanamadığı için değiştirilmedi.

## Değişen yollar
- .agent/PROGRESS.md
- .agent/HISTORY.md
- .env.example
- README.md
- public/sw.js
- src/App.tsx
- src/components/AppShell.tsx
- src/lib/pushNotifications.ts
- src/pages/AccountSettings.tsx
- src/pages/AppHome.tsx
- supabase/functions/deliver-push-notifications/index.ts
- supabase/functions/_shared/pushDeliveryPolicy.ts
- supabase/functions/_shared/pushDeliveryPolicy.test.mjs
- supabase/migrations/20260827231000_harden_web_push_delivery.sql
- supabase/tests/push_delivery_scenarios.md
- supabase/tests/push_subscriptions_scenarios.md
- package.json

## Doğrulamalar
- `npm run test:push`: PASS; 5 otomatik push policy/migration invariant testi geçti.
- `npm run lint`: PASS, 0 warning / 0 error.
- `npm run build`: PASS; TypeScript + Vite production build tamamlandı.
- `git diff --check`: PASS.
- `supabase db lint --linked`: PASS; bağlı mevcut uzak şemada hata yok. Bu komut yeni yerel migration uygulanmadığı için onun runtime semantiğini tek başına doğrulamaz.
- `supabase db push --linked --dry-run`: PASS; yalnız `20260827231000_harden_web_push_delivery.sql` uygulanacağı doğrulandı.
- `supabase db push --linked`: PASS; migration uzak veritabanına uygulandı.
- `supabase migration list --linked`: PASS; `20260827231000` local ve remote eşleşiyor.
- `supabase functions deploy deliver-push-notifications`: PASS; function ACTIVE version 12 olarak doğrulandı.
- Trivy `all`: PASS; vulnerability/secret/misconfig bulgusu yok, yalnız 16 LOW license bulgusu.
- `deno check supabase/functions/deliver-push-notifications/index.ts`: ÇALIŞMADI; ortamda `deno` komutu yok. Deploy bundling başarılı oldu.

## Kalan riskler
- Web Push dış servis olduğu için send başarılı olduktan sonra DB finalize öncesi worker crash olursa nadir duplicate yeniden gönderim penceresi tamamen ortadan kaldırılamaz; atomik claim eşzamanlı duplicate'i engeller ve notification `tag` aynı bildirimi cihazda replace etmeye yardımcı olur.
- `pushsubscriptionchange` tarayıcı desteği sınırlıdır; app hiç açılmadan subscription rotasyonu olduğunda authenticated server sync tüm tarayıcılarda garanti edilemez.
- Cron migration'ındaki hardcoded production function URL değiştirilmedi; güvenli ortam-spesifik URL/Vault standardı ayrıca ele alınmalı.
- Vercel `VITE_WEB_PUSH_PUBLIC_KEY` canlı Production ortam değişkeni doğrulandı ve eklendi. Yeni frontend deployment ile etkili olacak.

## Sonraki adım
Gerçek cihazlarda en az bir iPhone/PWA ve bir ikinci cihaz ile test bildirimi gönderip teslim davranışını gözlemle; gerekirse teslim gözlemlenebilirliğini ayrıca geliştir.

## 2026-08-28 Takvim aylık sayaç düzeltmesi
- Hedef: Takvim ay başlığı altındaki etkinlik/görev/farkındalık sayılarını dönem toplamı yerine seçili aya ait benzersiz kayıt sayılarıyla göstermek.
- Değişen yol: `src/pages/Calendar.tsx`.
- Karar: Etkinlik aynı ayda hem hazırlık hem etkinlik tarihi taşısa da bir kez sayılır; farkındalık tarih aralığı seçili ayla kesişiyorsa bir kez sayılır; görevler son tarih ayına göre sayılır.
- Doğrulama: `npm run lint`, `npm run build`, `git diff --check` PASS.
- Sonraki adım: Commit/push ve canlı Takvimde ay değiştirerek sayaçların değiştiğini doğrulamak.
