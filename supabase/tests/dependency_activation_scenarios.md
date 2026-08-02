# Bildirim testi — bağımlı görev aktifleşti

Bu senaryolar, `20260802170000_activate_dependent_tasks.sql` migration'ı uygulandıktan sonra gerçek Supabase test projesinde çalıştırılır.

## 1. SKS bağımlılığı

1. SKS durumu `Onaylandı` olunca aktive olacak, atanmış bir taslak görev oluşturulur.
2. SKS durumu `Onaylandı`ya geçer.
3. Görevin `Aktif` olduğu ve atanan her kişiye uygulama içi + e-posta olmak üzere iki `dependency_activated` bildirimi oluştuğu doğrulanır.

## 2. Görev tamamlanma bağımlılığı

1. Görev A'nın `Tamamlandı` durumuna bağlı, atanmış Taslak Görev B oluşturulur.
2. Görev A tamamlanır.
3. Görev B'nin aktifleştiği ve yalnızca B'nin atananlarına bildirim gittiği doğrulanır.

## 3. Birden fazla koşul

1. Bir taslak görev hem SKS onayına hem de başka bir görevin tamamlanmasına bağlanır.
2. İlk koşul sağlanır; görevin taslak kaldığı ve bildirim üretilmediği doğrulanır.
3. İkinci koşul da sağlanır; görevin aktifleştiği ve tek sefer bildirim üretildiği doğrulanır.

## 4. Güvenli istisnalar

1. SKS `Reddedildi` veya kaynak görev `İptal` durumuna geçer.
2. Bağımlı görev otomatik aktifleşmez. Bekleme/gözden geçirme bildirimi sonraki istisna migration'ında ayrıca eklenecektir.

## 5. Tarih bazlı bağımlılık

1. Etkinlik tarihinden belirli gün önce aktive olacak Taslak görev oluşturulur.
2. Bu görev anlık durum değişikliğiyle aktifleşmez.
3. Bu tür aktivasyon, pg_cron zamanlanmış tarama migration'ında test edilir.
