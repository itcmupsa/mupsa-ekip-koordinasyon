# Mobil Web Push teslim senaryoları

1. HTTPS ortamında aktif dönem üyesi ana sayfadaki **Bildirimleri aç** düğmesine basar.
2. Tarayıcı izin ister; izin verildikten sonra `push_subscriptions` tablosunda endpoint kaydı oluşur.
3. Kullanıcı aynı cihazda sayfayı yenilediğinde yeni abonelik satırı oluşmaz.
4. Kullanıcı **Bildirimleri kapat** dediğinde tarayıcı aboneliği ve kendi `push_subscriptions` kaydı kaldırılır.
5. Yeni bir uygulama içi bildirim oluştuğunda veritabanı trigger'ı aynı bildirim için `push` kanalında queued kayıt üretir.
6. `deliver-push-notifications` yalnızca `x-push-dispatch-secret` doğruysa çalışır; service role ve VAPID private key frontend'e gönderilmez.
7. Edge Function queued push kaydını aktif cihaz aboneliklerine gönderir ve başarılıysa `sent`, başarısızsa `failed` durumuna geçirir.
8. 404/410 dönen cihaz aboneliği pasifleştirilir.
9. Service worker bildirimi gösterir; bildirime dokunulduğunda ilgili etkinlik detayına açılır.
10. iOS cihazda bildirim için HTTPS, Ana Ekrana Ekleme ve kullanıcı tarafından bildirim izni gerekir.
