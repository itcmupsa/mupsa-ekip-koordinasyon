# Etkinlik Görev Pasifleştirme Kontrol Raporu

## Sonuç

Görev pasifleştirme ve yeniden aktifleştirme kodu incelendi ve `EventDetail.tsx` dosyasına entegre edildi. Kod doğrulaması başarılıdır; canlı test henüz yapılmamıştır.

## Uygulanan değişiklikler

- Fiziksel silme yerine `tasks.deleted_at` ve `deleted_by` kullanılıyor.
- Pasifleştirme yalnızca `super_admin` için gösteriliyor.
- Pasifleştirme öncesi onay penceresi var.
- Pasif görevler normal listede görünmüyor.
- `super_admin` pasif görevleri gösterme filtresini açabiliyor.
- Pasif görev yeniden aktifleştirilebiliyor.
- Pasif görevlerde düzenleme, durum ve atama işlemleri kilitleniyor.
- Görev notları, durumu ve atamaları korunuyor.
- Migration veya RLS değişikliği yapılmadı.

## Teknik doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.

## Bekleyen canlı test

1. Pasifleştirme onayını test et.
2. Pasif görevin normal listeden kaybolduğunu kontrol et.
3. `Pasif görevleri göster` filtresini aç.
4. Pasif görevde `Yeniden aktifleştir` seçeneğini kullan.
5. Görevin yeniden normal listeye geldiğini kontrol et.
6. Not, durum ve atamaların korunduğunu doğrula.
