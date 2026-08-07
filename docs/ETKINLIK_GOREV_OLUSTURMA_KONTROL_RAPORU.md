# Etkinlik Detay — Görev Oluşturma Kontrol Raporu

## Sonuç

Claude tarafından gönderilen `EventDetail.tsx` incelendi ve mevcut projeye entegre edildi.

## Yapılanlar

- Etkinlik sahibi veya `super_admin` için `Görev oluştur` butonu eklendi.
- Form alanları eklendi:
  - Görev adı
  - Açıklama
  - Son tarih (`datetime-local`)
  - Öncelik (`Düşük`, `Normal`, `Yüksek`, `Acil`)
- `tasks` tablosuna `event_id`, `title`, `description`, `created_by`, `deadline_at` ve `priority` alanlarıyla kayıt ekleniyor.
- Boş görev adı engelleniyor.
- Boş son tarih `null`, dolu tarih timestamptz uyumlu ISO değeri olarak gönderiliyor.
- Başarılı kayıttan sonra form kapanıyor ve görev listesi yeniden yükleniyor.
- Hata durumunda form açık kalıyor ve girilen bilgiler korunuyor.
- İptal butonu eklendi.

## Kapsam dışı

- Görev atama veya destekleyen kişi ekleme
- Görev düzenleme veya silme
- Bağımlılık yönetimi
- Migration, RLS veya Auth değişikliği

## Doğrulama

- `npm run lint` başarılı.
- `npm run build` başarılı.
- `git diff --check` başarılı.
- Canlı görev oluşturma testi henüz yapılmadı.
