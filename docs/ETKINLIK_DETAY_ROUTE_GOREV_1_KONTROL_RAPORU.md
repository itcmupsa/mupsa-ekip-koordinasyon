# Kontrol Raporu — Etkinlik Detay Route Görev 1

**Tarih:** 3 Ağustos 2026

## Eklenenler

- `src/pages/EventDetail.tsx` oluşturuldu.
- `/app/etkinlikler/:eventId` route’u eklendi.
- Etkinlik listesi kartları detay route’una bağlandı.
- Detay sayfasında geçici başlık, geri bağlantı ve `eventId` gösteriliyor.

## Bu adımda özellikle yapılmayanlar

- Supabase sorgusu
- Etkinlik detay verisi çekme
- Güncelleme veya silme
- SKS ve görev işlemleri
- Migration, RLS ve Auth değişikliği

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.
