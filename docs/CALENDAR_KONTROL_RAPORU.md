# Takvim kontrol raporu

## Uygulanan düzeltmeler

- Manuel takvim kayıtları için `calendar_entries` migration'ı eklendi.
- Soft-delete, audit ve dönem kilidi davranışı eklendi.
- Görev son tarihi sorgusu frontend'den gelen `profileId` değerine bırakılmadı.
- `get_my_calendar_task_deadlines(target_period_id)` RPC'si eklendi; görev sahibi `auth.uid()` ile veritabanında doğrulanıyor.
- Tamamlanmış, iptal edilmiş, taslak, silinmiş görevler ve silinmiş etkinliklere bağlı görevler takvimden dışlandı.
- Takvim route'u ve ana sayfa hızlı erişim bağlantısı eklendi.
- Excel importu, örnek veri ve renk sistemi eklenmedi.

## Kontroller

- `npm run lint`: başarılı
- `npm run build`: başarılı
- `git diff --check`: başarılı

`20260810050000_add_calendar_entries.sql` migration'ı uzak Supabase projesine uygulandı ve `supabase migration list` ile local/remote eşleşmesi doğrulandı. RPC, RLS, audit ve dönem kilidi için canlı kullanıcı testleri henüz yapılmadı.
