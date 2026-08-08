# Faz 2 / Adım 1 Kontrol Raporu

## Kapsam

Rapor, bağlantı ve dosya metadata veritabanı altyapısı hazırlandı ve uzak Supabase projesine uygulandı. Frontend dosyaları değiştirilmedi.

## Düzeltilen noktalar

- `event_reports`, `event_links` ve `event_files` tabloları eklendi.
- Event/task ilişkisinin tam olarak bir üst kayda bağlanması check constraint ile zorlandı.
- Dosya boyutu veritabanında en fazla `5242880` byte olarak sınırlandı.
- Aktif üyelik kontrolü tüm insert/update RLS politikalarında zorunlu hale getirildi.
- Dönem kilidi mevcut ortak trigger fonksiyonuna bağlandı.
- `event_report`, `event_link` ve `event_file` audit türleri eklendi.
- Soft delete alanları ve `deleted_at`/`deleted_by` bütünlüğü eklendi.
- Event ve task bazlı ayrı indeksler eklendi.

## Dosyalar

- `supabase/migrations/20260808110000_add_reports_links_files.sql`
- `supabase/tests/reports_links_files_scenarios.md`
- `docs/FAZ2_ADIM1_KONTROL_RAPORU.md`

## Kontroller

- `npm run lint`: Başarılı
- `npm run build`: Başarılı
- `git diff --check`: Başarılı
- Supabase lokal SQL lint: Çalıştırılamadı; lokal PostgreSQL/Docker çalışmıyor.
- `supabase migration list`: Yerel ve uzak `20260808110000` migration kayıtları eşleşti.
- Uzak Supabase transaction/rollback testleri: Başarılı; test verisi kalıcı bırakılmadı.
- Uzak şema doğrulaması: Yeni tabloların constraint ve trigger kayıtları bulundu.
- RLS policy sorgusu: CLI Management API sorgusu zaman aşımına uğradığı için ayrı listeleme çıktısı alınamadı; policy tanımları migration içeriğiyle kontrol edildi.
