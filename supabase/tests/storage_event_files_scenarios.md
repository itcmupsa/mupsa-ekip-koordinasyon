# Faz 2 / Adım 2C — Storage test senaryoları

Bu senaryolar migration canlı Supabase’e uygulanmadan önce gözden geçirilecek, uygulandıktan sonra gerçek test kullanıcılarıyla yürütülecektir. Testlerde service-role anahtarı frontend’e koyulmayacak ve test dosyaları işlem sonunda Storage’dan silinecektir.

## Beklenen yapı

- Bucket: `event-files`
- Görünürlük: private
- Boyut sınırı: `5242880` byte
- Path: `events/{event_id}/{unique_id}-{safe_file_name}`

## Kontroller

1. `storage.buckets` içinde `event-files` kaydı bulunur; `public = false` ve `file_size_limit = 5242880` olur.
2. Aktif dönem üyesi, aktif döneme ait etkinliğin aktif `event_files` metadata kayıtlarını okuyabilir.
3. Aktif dönem üyesi, etkinlik yöneticisi olmadığı bir etkinliğin Storage dosyasını okuyabilir; okuma kuralı gerçek ve silinmemiş etkinlik path’iyle sınırlıdır.
4. Aktif dönem üyesi, sahibi olmadığı etkinlik için Storage upload başlatamaz.
5. Etkinlik sahibi, kendi etkinliği için Storage upload yapabilir.
6. `super_admin`, aktif etkinlik için Storage upload yapabilir.
7. Path `events/{başka-etkinlik-id}/...` ile başka etkinliğe dosya yazma reddedilir.
8. Geçersiz veya eksik event ID içeren path reddedilir ve policy cast hatası üretmez.
9. Kilitli döneme ait etkinlik için upload ve object update reddedilir.
10. Tam 5 MB dosya kabul edilir; 5 MB üzerindeki dosya Storage API tarafından reddedilir.
11. Anonim kullanıcı private bucket’ın public URL’sinden dosyayı okuyamaz.
12. `event_files.storage_path`, Storage object `name` alanıyla birebir aynı path’i tutar.
13. Metadata soft-delete edildiğinde Storage nesnesi otomatik silinmez; varsayılan frontend listesi `deleted_at is null` ile filtreler.
14. Storage nesnesinin kalıcı silinmesi yalnızca `super_admin` tarafından yapılabilir.

## Test yöntemi

- Okuma ve yükleme senaryoları Supabase Dashboard/API üzerinden gerçek test kullanıcı oturumlarıyla yürütülür.
- `auth.uid()` SQL Editor’da elle atanmış bir değer gibi varsayılmayacaktır.
- Her test için benzersiz bir etkinlik/path kullanılır.
- Başarılı upload sonrası hem Storage nesnesi hem `event_files` metadata kaydı kontrol edilir.
- Test sonunda metadata kayıtları rollback/temizleme ile, Storage nesneleri ise Storage API üzerinden silinir.
