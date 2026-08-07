# Etkinlik Detay — Görev Listesi Kontrol Raporu

## Sonuç

Claude tarafından gönderilen `EventDetail.tsx` incelendi ve mevcut projeye entegre edildi.

## Yapılanlar

- Etkinliğe bağlı görevler `tasks.event_id` üzerinden okunuyor.
- Silinmiş görevler `deleted_at is null` filtresiyle dışarıda bırakılıyor.
- Görevler son tarih sırasına göre listeleniyor; son tarihi olmayanlar sonda gösteriliyor.
- Görev kartında ad, durum etiketi, son tarih ve öncelik gösteriliyor.
- Durum etiketleri `task_progress_statuses` tablosundan çözülüyor.
- `task_assignees` ve `profiles` üzerinden atanmış kişiler gösteriliyor.
- `primary`, `supporting` ve `informed` atama türleri korunuyor.
- Görev yoksa `Bu etkinlik için henüz görev oluşturulmamış.` mesajı gösteriliyor.
- Ana görev sorgusu hata verirse yalnızca görevler bölümünde Türkçe hata mesajı gösteriliyor.

## Kapsam dışı

- Görev oluşturma, düzenleme veya silme
- Görev ataması değiştirme
- Bağımlılık yönetimi
- Migration, RLS veya Auth değişikliği

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.
- Canlı görev listesi testi henüz yapılmadı.
