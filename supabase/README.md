# Supabase veritabani

Bu klasor Faz 1 / Adim 1 veritabani iskeletini icerir.

`migrations/20260802120000_faz1_database_skeleton.sql` dosyasi sunlari kurar:

- Supabase Auth ile bagli kullanici profilleri ve donem uyelikleri
- Koordinatorlukler, donemler ve Super Yonetici rol modeli
- Etkinlikler, surec sorumlulari ve ekip uyeleri
- Cok kisili gorev atamasi ve yapilandirilmis gorev bagimliliklari
- Uygulama ici/e-posta/push bildirim kuyrugu
- Geri alinabilir silme, donem kilidi ve audit gecmisi
- Row Level Security (RLS) politikalarinin ilk surumu

Sonraki migration'lar bu iskeleti bozmadan eklenir:

- `20260802130000_add_period_membership_audit.sql`: donem uyeligi, rol ve yetki degisikliklerini audit gecmisine ekler.
- `20260802140000_queue_task_assigned_notifications.sql`: yeni gorev atamasinda uygulama ici ve e-posta bildirim kuyrugu kayitlarini uretir. E-posta gonderimi bu asamada henuz yapilmaz.
- `20260802150000_add_push_subscriptions.sql`: kullanicilarin birden fazla cihaz/tarayici icin push aboneliklerini ve gerekli teknik anahtarlarini saklar. Abonelik anahtarlari audit gecmisine yazilmaz.
- `20260802160000_queue_sks_status_changed_notifications.sql`: SKS durumu degisince etkinligin aktif donemindeki tum ekibe uygulama ici ve e-posta bildirim kuyrugu kayitlari uretir.
- `20260802170000_activate_dependent_tasks.sql`: SKS onayi veya kaynak gorevin tamamlanmasi sonrasinda tum kosullari saglanan Taslak gorevleri Aktif yapar ve yalnizca atanmislarina bildirim uretir. Tarih tabanli kosullar sonraki `pg_cron` migration'inda tamamlanir.
- `20260802180000_queue_event_date_changed_notifications.sql`: etkinligin tarih alanlari degisince etkinlik sahibi, etkinlik/surec uyeleri ve gorev atanan aktif kisilere bildirim uretir; gorev tarihlerini otomatik kaydirmaz.
- `20260802190000_schedule_task_reminders_and_date_dependencies.sql`: `pg_cron` ile geciken aktif gorevleri her 15 dakikada bir tarar (ilk bildirim + 24 saat sonra bir kez hatirlatma); her gun Turkiye saatiyle 09.00'da sonraki 24 saat icindeki gorevleri ve tarih tabanli bagimliliklari kontrol eder. Gecikme bildirimi etkinlik sahibi, asil/destek atananlar, Baskan ve Super Yoneticilere gider. Tarih bagimliliginda kesin tarih, yoksa tahmini tarih kullanilir.
- `20260825090000_add_ai_foundation.sql`: Faz 4 AI katmanını kullanıcıya açmadan; dönem bazlı kapalı özellik ayarı, yönetim onaylı kaynak sınıflandırması, asenkron iş kuyruğu, ücretsiz kota sayaçları, embedding parçaları ve doğrulanmış çıktı deposunu kurar. Gemini anahtarı veya API çağrısı içermez.

Bildirim ve push altyapisinin test senaryolari `tests/` klasorunde tutulur. Bunlara `notification_task_assigned_scenarios.md`, `notification_sks_status_changed_scenarios.md`, `dependency_activation_scenarios.md`, `notification_event_date_changed_scenarios.md`, `scheduled_task_notifications_scenarios.md`, `scheduled_task_notifications_live_test.sql` ve `push_subscriptions_scenarios.md` dahildir.

2 Agustos 2026'da migration'lar gercek Supabase projesinde SQL Editor ile uygulanmis ve temel bildirim/push senaryolari test edilmistir. Ayrintilar: `tests/REAL_SUPABASE_TEST_REPORT.md`.

> `20260802190000` uygulanmadan once Supabase Dashboard > Database > Extensions bolumunden `pg_cron` etkinlestirilmelidir. Bu uzanti, Supabase tarafindan proje duzeyinde kurulur; migration bu ayari kendisi yapmaz.

> Baseline durumu: 2 Agustos 2026'da proje Supabase CLI ile baglandi; ilk dort migration `migration repair --status applied` ile uzak kayit defterinde isaretlendi. `supabase migration list` yerel ve uzak surumlerin tamamini eslesmis, `supabase db push --dry-run` ise veritabanini guncel olarak dogruladi.

Migration uygulandiginda etkinlik, gorev veya kullanici kaydi olusturulmaz. Yalnizca master dokumanda tanimlanan sabit durumlar, koordinatorlukler ve 2026-2027 donemi eklenir.

## Ilk canli yonetici kurulumu

Supabase Auth uzerinden ilk kullanici davet edildikten sonra, ilk Super Yonetici uyeligi Supabase SQL Editor veya guvenli yonetim araci ile olusturulmalidir. Bu islem uygulama arayuzu gelmeden once bir kez yapilir. Sonraki kullanici ve rol yonetimi uygulamanin yonetici ekraniyla yapilacaktir.

E-posta adresleri `auth.users` tablosunda kalir; `public.profiles` tablosunda ekip listesinde gorunen ad tutulur. Bu nedenle kullanicilar birbirlerinin e-posta adreslerini uygulama veritabanisi sorgularindan goremez.
