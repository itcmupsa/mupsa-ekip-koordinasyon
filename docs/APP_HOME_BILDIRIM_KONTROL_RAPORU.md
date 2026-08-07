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

## Canlı test sonucu

Canlı test tamamlandı. Görev ataması ve etkinlik tarihi değişiklikleri sonucunda bildirimler `/app` sayfasında göründü. Tek bildirime tıklanınca yeni sayısı azaldı; “Tümünü okundu işaretle” işlemi sonrası yeni sayısı kayboldu ve sayfa yenilemesinde okundu durumu korundu.
