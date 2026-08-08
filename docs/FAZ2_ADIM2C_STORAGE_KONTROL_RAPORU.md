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

- Bu migration henüz canlı Supabase’e uygulanmadı.
- Storage canlı testleri henüz çalıştırılmadı.
- Frontend dosya yükleme ekranı henüz eklenmedi.
- Storage upload ile `event_files` metadata insert işleminin atomik olmadığı ayrıca frontend aşamasında ele alınmalıdır.
