# Bildirim testi — etkinlik tarihi değişti

Bu senaryolar, `20260802180000_queue_event_date_changed_notifications.sql` migration'ı uygulandıktan sonra gerçek Supabase test projesinde çalıştırılır.

## 1. Hedefli alıcılar

1. Etkinlik sahibi, etkinlik üyesi, süreç üyesi ve etkinlikte görevi olan aktif kişilerden oluşan bir etkinlik hazırlanır.
2. Etkinliğin tarih alanlarından biri veya birkaçı değiştirilir.
3. Her benzersiz aktif ilgili kişi için uygulama içi + e-posta olmak üzere iki `event_date_changed` bildirimi oluştuğu doğrulanır.
4. Dönemde pasif olan kişi etkinlikte yer alsa bile bildirim almadığı doğrulanır.

## 2. Değişiklik içeriği

1. Aynı işlemde tahmini tarih ve kesin tarih değiştirilir.
2. Bildirim metadata'sında yalnızca değişen tarih alanlarının eski/yeni değerleri bulunduğu doğrulanır.
3. Bildirim gövdesinde değişen alanların açıkça belirtildiği doğrulanır.

## 3. Yan etki olmaması

1. Yalnızca mekân veya açıklama değiştirilir.
2. Yeni `event_date_changed` bildirimi oluşmadığı doğrulanır.
3. Tarih değişikliğinin görev son tarihlerini veya tarih bazlı bağımlı görevleri otomatik değiştirmediği doğrulanır.
