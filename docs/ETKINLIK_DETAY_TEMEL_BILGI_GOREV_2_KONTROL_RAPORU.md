# Kontrol Raporu — Etkinlik Detay Temel Bilgi Görev 2

**Tarih:** 3 Ağustos 2026

## Eklenenler

- Etkinlik detayında aktif dönem üyeliği kontrolü yapılıyor.
- Etkinlik, `eventId`, aktif `periodId` ve `deleted_at is null` koşullarıyla okunuyor.
- Etkinlik adı ve açıklaması gösteriliyor.
- Açıklama boşsa `Açıklama eklenmemiş` metni kullanılıyor.
- Yükleniyor, yetkisiz, bulunamadı ve hata durumları Türkçe gösteriliyor.

## Kapsam dışı

- Durum ve tarih alanları
- Sorumlu kişi
- SKS
- Görevler
- Düzenleme veya silme
- Migration, RLS ve Auth değişikliği

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.
