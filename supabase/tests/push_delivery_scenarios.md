# Mobil Web Push teslim senaryoları

Bu senaryolar `20260827231000_harden_web_push_delivery.sql`, `deliver-push-notifications` ve `public/sw.js` için kabul kriterleridir. Gerçek provider/deploy testi bu aşamada yapılmaz.

1. **7+ gün uygulama açılmadan teslim**
   - Kullanıcı PWA'yı kurar, bildirim izni verir ve subscription sunucuya kaydolur.
   - Uygulama/oturum tarayıcıda açık değilken sunucu yeni push notification oluşturur.
   - Cron Edge Function'ı çağırır; teslim client session'a ihtiyaç duymadan claim edilir.
   - Provider kabulünde Web Push TTL yaklaşık 28 gün (`2419200` saniye) gönderilir.

2. **Telefon geçici offline / provider transient hata**
   - Network hatası, 408, 425, 429 veya 5xx transient kabul edilir.
   - Aynı device delivery `transient_failed` olur ve `next_attempt_at` ile yeniden kuyruğa girer.
   - Retry dizisi kısa denemelerden sonra saat/gün ölçeğine uzar: 1 dk, 5 dk, 15 dk, 1 sa, 6 sa, 24 sa, 48 sa, 96 sa, 7 gün.

3. **Retry backoff tüketimi**
   - Her claim `attempt_count` değerini atomik artırır.
   - Transient hata için sıradaki backoff uygulanır.
   - Tanımlı uzun retry bütçesi tüketildikten sonra device delivery `permanent_failed` olur; sonsuz hot-loop oluşmaz.

4. **İki eşzamanlı dispatcher**
   - İki worker aynı anda `claim_push_notification_deliveries` çağırır.
   - `FOR UPDATE SKIP LOCKED` nedeniyle aynı delivery id yalnızca bir worker'a döner.
   - İkinci worker aynı notification'ın başka cihaz teslimini alabilir ama aynı cihaz teslimini alamaz.
   - 10 dakikadan eski `processing` lease crash/stuck kabul edilip tekrar kuyruğa alınır.

5. **Aynı kullanıcı, iki cihaz: biri success, biri transient**
   - Notification için iki ayrı `push_notification_deliveries` satırı oluşur.
   - Laptop `sent` olurken telefon `transient_failed` kalabilir.
   - Notification aggregate durumu telefon terminal hale gelene kadar `queued` kalır; laptop başarısı telefon retry'ını silmez.
   - Tüm cihazlar terminal olduğunda en az bir cihaz başarılıysa notification `sent`, hiçbiri başarılı değilse `failed` olur.

6. **404/410 stale subscription**
   - 404 veya 410 alan subscription `is_active=false` ve `failed_at` ile pasifleştirilir.
   - İlgili attempt kalıcı başarısızdır; retry edilmez.
   - Sonraki claim turu aynı pasif subscription'a bağlı açık attempt'ları kalıcı kapatır.

7. **Logout A -> login B aynı browser**
   - Logout öncesinde A'nın mevcut endpoint satırı A profili için silinir ve browser subscription iptal edilir.
   - DB silme başarısız olsa bile browser endpoint'inin provider tarafında geçersizleşmesi eski kullanıcı bildiriminin yeni kullanıcıya görünmesini engelleyen ikinci savunmadır.
   - B login sonrası bildirim izni hâlâ `granted` ve cihazda açık bir opt-out yoksa app açılış sync'i yeni browser subscription oluşturup `sync_push_subscription` ile B profiline bağlar; yeniden izin istemez.
   - A'ya ait aktif subscription satırı B oturumunda kullanılmamalıdır; eski/reassigned delivery satırları dispatcher tarafından kalıcı kapatılır.
   - Normal logout olmayan 7+ günlük kapalı kullanımda subscription silinmez.

8. **Subscription rotation**
   - Uygulama her authenticated açılışta mevcut browser subscription'ı sunucuya senkronlar.
   - `pushsubscriptionchange` destekleyen tarayıcıda SW eski application server key ile yeniden subscribe etmeyi dener ve açık client'a sync mesajı yollar.
   - Sayfa kapalıyken güvenli authenticated server sync yapılamayacağı ve browser desteği sınırlı olduğu için bu olay tek başına kesintisiz teslim garantisi sayılmaz.

9. **Notification alıcısı sunucu alanlarını değiştiremez**
   - Authenticated recipient kendi `read_at` alanını güncelleyebilir.
   - Aynı kullanıcı `title`, `body`, `delivery_status`, `scheduled_for`, `metadata`, `recipient_id` vb. alanları UPDATE etmeye çalıştığında PostgreSQL column privilege nedeniyle reddedilmelidir.

10. **Push subscription gizliliği**
    - Normal kullanıcı yalnızca kendi `push_subscriptions` satırını okuyabilir.
    - Süper Yönetici rolü başka kullanıcıların endpoint/p256dh/auth değerlerini SELECT edemez.
    - Edge Function service role ile teslimat için bu materyale erişmeye devam eder.

11. **Uzun Türkçe/Unicode payload**
    - Uygulama içi notification `body` tam uzunluğunu korur.
    - Edge Function Web Push JSON boyutunu UTF-8 byte olarak ölçer.
    - 3000 byte güvenli sınırı aşılırsa yalnız push gövdesi Unicode code point sınırında `…` ile kısaltılır.

12. **Invalid/external notification click URL**
    - Payload üreticisi yalnız `/app` veya `/app/...` hedefini kabul eder.
    - Service Worker ayrıca URL'yi `self.location.origin` ile parse eder.
    - `https://evil.example/...`, `//evil.example`, `/login`, bozuk URL vb. hedefler `/app` fallback'ine gider.

13. **VAPID yapılandırması**
    - `VITE_WEB_PUSH_PUBLIC_KEY` eksik build'de frontend `not_configured` olur; hardcoded eski anahtar fallback'i yoktur.
    - Private VAPID key/service role frontend veya repoya eklenmez.
    - Canlı build öncesi public key hosting env'de açıkça tanımlanmalıdır.

14. **Cron/function URL ortam izolasyonu**
    - Mevcut migration production Supabase function URL'sini hardcode eder.
    - Güvenilir DB-içi proje URL kaynağı/Vault standardı doğrulanmadan scheduler değiştirilmemelidir; yanlış ortamı sessizce kıracak yeni fallback eklenmez.
