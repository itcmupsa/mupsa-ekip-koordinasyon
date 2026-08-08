# Faz 2 / Adım 2C — Storage altyapısı kontrol raporu

## Hazırlananlar

- `supabase/migrations/20260809010000_add_event_files_storage.sql`
- `supabase/tests/storage_event_files_scenarios.md`

## Kapsam

- `event-files` adlı private bucket
- 5 MB dosya boyutu sınırı
- Aktif ve silinmemiş etkinlik path’iyle sınırlandırılmış okuma
- Etkinlik sahibi veya `super_admin` için upload/update
- Dönem kilidi kontrolü
- Storage nesnesi için `super_admin` kalıcı silme yetkisi

## Yapılan düzeltmeler

Gemini teslimindeki policy yalnızca `events/` path başlangıcını kontrol ediyordu. Bu nedenle aktif bir üye, mevcut olmayan veya başka bir etkinliğe ait path’leri okuyabilirdi. Düzeltilen migration, path’in ikinci parçasını gerçek etkinlik kaydıyla karşılaştırır; etkinliğin silinmemiş ve döneminin aktif olmasını zorunlu tutar. Update için hem eski path (`using`) hem yeni path (`with check`) kontrol edilir.

## Durum

- `20260809010000_add_event_files_storage.sql` migration'ı canlı Supabase’e uygulandı.
- Canlı bucket kontrolü başarılı: `event-files`, `public = false`, `file_size_limit = 5242880`.
- Canlı policy kontrolü başarılı: okuma, upload, update ve super_admin silme policy’leri beklenen tanımlarla mevcut.
- Anonim public URL kontrolünde dosya erişimi verilmedi; bucket private davranışı doğrulandı.
- Gerçek oturumlarla dosya yükleme, indirme, 5 MB sınırı, pasifleştirme ve yeniden aktifleştirme testleri tamamlandı.
- Frontend dosya yükleme ekranı `src/pages/EventDetail.tsx` içine eklendi ve canlıda doğrulandı.
- Storage upload ile `event_files` metadata insert işleminin atomik olmadığı ayrıca frontend aşamasında ele alınmalıdır.
