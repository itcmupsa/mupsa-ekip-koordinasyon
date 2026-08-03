# Kontrol Raporu — Etkinlik Listeleme Adım 1

**Tarih:** 3 Ağustos 2026

## Eklenenler

- `/app/etkinlikler` route’u eklendi.
- Aktif dönem üyeleri etkinlikleri görebilir.
- Yalnızca aktif döneme ait ve `deleted_at` değeri boş etkinlikler listelenir.
- Etkinlik adı, durum etiketi, sorumlu kişi, planlama tarihi ve tahmini/onaylanmış tarih gösterilir.
- Etkinlik yoksa, yüklenirken veya hata oluştuğunda Türkçe durum mesajı gösterilir.
- `/app` ana ekranına etkinlikler bağlantısı eklendi.

## Kapsam dışı

- Etkinlik oluşturma veya düzenleme
- SKS alanı
- Görev, sorumlu atama ve bağımlılıklar
- Migration veya RLS değişikliği

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.

Canlı ekran testi, Cloudflare Pages’in yeni commit’i yayınlamasından sonra yapılmalıdır.
