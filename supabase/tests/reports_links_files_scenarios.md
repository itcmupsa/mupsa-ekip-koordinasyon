# Rapor, Bağlantı ve Dosya Metadata Test Senaryoları

Migration: `20260808110000_add_reports_links_files.sql`

Testler gerçek Supabase projesinde, ayrı test kayıtlarıyla ve test sonunda kayıtlar temizlenerek çalıştırılmalıdır. Bu migration henüz uzak Supabase'e uygulanmamıştır.

## Yetki ve okuma

1. Aktif dönem üyesi rapor, bağlantı ve dosya metadata kayıtlarını okuyabilir.
2. Aktif olmayan veya dönem üyeliği olmayan kullanıcı bu kayıtları okuyamaz ve yazamaz.
3. Etkinlik sahibi etkinlik raporu ekleyebilir, güncelleyebilir ve pasifleştirebilir.
4. Etkinlik sahibi etkinliğe bağlı bağlantı ve dosya metadata'sı ekleyebilir.
5. `can_manage_task()` kapsamındaki görev yöneticisi, `task_id` ile bağlı bağlantı ve dosya metadata'sı ekleyebilir.
6. Görev yöneticisi olmadığı göreve bağlı kayıt ekleyemez.
7. Süper Yönetici etkinlik ve görev bağlantılı tüm kayıtları yönetebilir.

## İlişki ve veri kısıtları

8. `event_links` veya `event_files` için yalnızca `event_id` dolu kayıt kabul edilir.
9. Yalnızca `task_id` dolu kayıt kabul edilir.
10. Hem `event_id` hem `task_id` dolu kayıt reddedilir.
11. Her iki ilişki alanı boş kayıt reddedilir.
12. Boş başlık, rapor metni, URL, dosya yolu veya dosya adı reddedilir.

## Pasifleştirme ve audit

13. Yetkili kullanıcı `deleted_at`, `deleted_by` ve isteğe bağlı `deletion_note` alanlarını doldurarak kaydı pasifleştirebilir.
14. `deleted_at` doluyken `deleted_by` boş bırakılamaz.
15. Pasifleştirme ve geri alma işlemleri `audit_logs` tablosunda `event_report`, `event_link` veya `event_file` olarak görünür.
16. Uygulama listeleri varsayılan olarak `deleted_at is null` filtresi kullanmalıdır. RLS, aktif üyelerin pasif geçmiş kayıtlarını okuyabilmesine izin verir; bu mevcut `events`/`tasks` davranışıyla aynıdır.
17. Süper Yönetici için fiziksel silme mevcut proje politikasındaki istisna olarak ayrıca doğrulanmalıdır; normal akış pasifleştirmedir.

## Dönem kilidi

18. Kilitli dönemde normal etkinlik sahibi rapor, bağlantı veya dosya metadata'sı ekleyemez, güncelleyemez veya silemez.
19. Kilitli dönemde `can_manage_task()` kapsamındaki normal görev yöneticisi yazamaz.
20. Kilitli dönemde Süper Yönetici ekleme, güncelleme ve geri alma yapabilir.
21. `task_id` ile bağlı kayıtlarda kilit, görevin bağlı olduğu etkinliğin döneminden hesaplanır.

## Dosya boyutu

22. `file_size_bytes = 1` kabul edilir.
23. `file_size_bytes = 5242880` kabul edilir.
24. `file_size_bytes = 5242881`, `0` veya negatif değer reddedilir.

## Bağımsız kontrol

- Frontend dosyalarında değişiklik olmamalıdır.
- Migration içinde Storage yükleme veya gizli anahtar bulunmamalıdır.
- `audit_logs.entity_type` kısıtı yeni üç türü kabul etmelidir.
- Dönem kilidi trigger'ları üç yeni tabloya bağlı olmalıdır.
