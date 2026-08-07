# AppHome Bildirim Alanı Kontrol Raporu

## Yapılanlar

- `notifications` tablosundan yalnızca oturum açan kullanıcının `in_app` kayıtları okunuyor.
- En yeni 20 bildirim listeleniyor.
- Okunmamış bildirim sayısı gösteriliyor.
- Tek bildirim tıklanınca `read_at` güncelleniyor.
- “Tümünü okundu işaretle” yalnızca ekranda listelenen kullanıcının okunmamış bildirimlerini güncelliyor.
- `event_id` bulunan bildirimler ilgili etkinlik detayına yönlendiriyor.
- Yalnızca `task_id` bulunan bildirimlerde görevden bağlı etkinlik sorgulanıyor.
- Aktif üyeliği olmayan kullanıcı için bildirim sorgusu çalıştırılmıyor.
- Gerçek e-posta/push gönderimi eklenmedi.

## İnceleme düzeltmeleri

- Tekil okundu güncellemesinde hata kontrolü eklendi.
- Kullanıcıya ait kayıt filtresi update sorgusunda da korundu.
- `alert` yerine mevcut bildirim hata alanı kullanıldı.
- `any` kullanılmadı.

## Yerel kontroller

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.

## Bekleyen canlı test

Canlı sitede bildirim üreten bir işlem yapılmalı. Görev atama veya mevcut tetikleyicilerden biri çalıştırıldıktan sonra `/app` sayfasında bildirim görünmeli; bildirim tıklanınca okundu durumu değişmeli ve ilgili etkinliğe gidilmelidir.
