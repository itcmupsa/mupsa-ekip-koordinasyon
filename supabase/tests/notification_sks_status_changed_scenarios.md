# Bildirim testi — SKS durumu değişti

Bu senaryolar, `20260802160000_queue_sks_status_changed_notifications.sql` migration'ı uygulandıktan sonra gerçek Supabase test projesinde çalıştırılır.

## 1. Tüm aktif döneme bildirim

1. Aynı dönemde üç aktif ekip üyesi, ayrıca bir pasif ekip üyesi oluşturulur.
2. SKS durumu örneğin `Başvuru Hazırlanıyor`dan `Onaylandı`ya değiştirilir.
3. Her aktif üyeye ikişer kayıt (uygulama içi + e-posta) oluştuğu; pasif üyeye kayıt oluşmadığı doğrulanır.
4. Tüm kayıtların doğru `event_id`, `sks_status_changed` türü ve `queued` teslimat durumunda olduğu doğrulanır.

## 2. Metin ve değişiklik bilgisi

1. Bildirim gövdesinde etkinlik adının, eski durumun ve yeni durumun doğru yazdığı doğrulanır.
2. `metadata` içindeki eski/yeni SKS durumları ve değişikliği yapan kişi doğrulanır.

## 3. Değişiklik yoksa bildirim yok

1. Etkinlikte başka bir alan değiştirilir veya SKS durumu aynı değerde tekrar kaydedilir.
2. Yeni `sks_status_changed` bildirimi oluşmadığı doğrulanır.

## 4. Durumun geri alınması

1. SKS durumu daha önceki bir değere geri alınır.
2. Bu gerçek değişiklik için her aktif üyeye yeni bildirim üretildiği doğrulanır; önceki değişikliğin bildirimleri tekrar kullanılmaz.
